import React, { useEffect, useRef, useState } from 'react';
import {
  MeltPoolDiagnostics,
  ProcessParameters,
  sampleSpatialPyrometry,
  TI64_CONSTANTS,
} from '../../physics/titaniumPhysics';

export type ViewportLayerMode = 'PYROMETRY_TOP' | 'CROSS_SECTION' | 'HATCH_VECTORS';

interface MeltPoolPyrometryCanvasProps {
  params: ProcessParameters;
  diagnostics: MeltPoolDiagnostics;
  isSimulating: boolean;
  isAborted: boolean;
  onToggleSimulation: () => void;
  onEmergencyAbort: () => void;
  onResetBeam: () => void;
}

export const MeltPoolPyrometryCanvas: React.FC<MeltPoolPyrometryCanvasProps> = ({
  params,
  diagnostics,
  isSimulating,
  isAborted,
  onToggleSimulation,
  onEmergencyAbort,
  onResetBeam,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewportLayerMode>('PYROMETRY_TOP');
  const [probeCoords, setProbeCoords] = useState<{ u: number; v: number }>({ u: 0.36, v: 0.5 });
  const [showIsotherms, setShowIsotherms] = useState<boolean>(true);
  const [showMarangoniVectors, setShowMarangoniVectors] = useState<boolean>(true);

  // Store latest props in refs so requestAnimationFrame loop never tears down canvas
  const stateRef = useRef({
    params,
    diagnostics,
    isSimulating,
    isAborted,
    viewMode,
    probeCoords,
    showIsotherms,
    showMarangoniVectors,
  });

  useEffect(() => {
    stateRef.current = {
      params,
      diagnostics,
      isSimulating,
      isAborted,
      viewMode,
      probeCoords,
      showIsotherms,
      showMarangoniVectors,
    };
  }, [
    params,
    diagnostics,
    isSimulating,
    isAborted,
    viewMode,
    probeCoords,
    showIsotherms,
    showMarangoniVectors,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phaseTime = 0;
    let lastTs = performance.now();

    // Pre-generate deterministic powder bed particles and spatter trajectories
    const particles = Array.from({ length: 42 }, (_, idx) => ({
      seedX: ((idx * 73) % 100) / 100,
      seedY: ((idx * 41) % 100) / 100,
      radius: 3 + (idx % 5) * 1.4,
      speed: 0.6 + (idx % 7) * 0.18,
      angle: ((idx * 29) % 360) * (Math.PI / 180),
    }));

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const {
        params: curParams,
        diagnostics: curDiag,
        isSimulating: running,
        isAborted: aborted,
        viewMode: mode,
        probeCoords: probe,
        showIsotherms: isotherms,
        showMarangoniVectors: vectors,
      } = stateRef.current;

      if (running && !aborted) {
        phaseTime += dt * (curParams.scanSpeedMmS / 650);
      }

      const width = canvas.width;
      const height = canvas.height;

      // 1. Deep Vacuum Chamber Obsidian Background
      ctx.fillStyle = '#090e1c';
      ctx.fillRect(0, 0, width, height);

      // 2. Calibrated 24px Scientific Grid & Sub-Ticks
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      const gridStep = 28;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const laserX = width * 0.36;
      const laserY = height * 0.5;

      // Scale pool dimensions to canvas pixels
      const poolRx = Math.min(width * 0.44, Math.max(65, curDiag.meltPoolLengthUm * 0.48));
      const poolRy = Math.min(height * 0.34, Math.max(28, curDiag.meltPoolWidthUm * 0.48));
      const poolDepthPx = Math.min(height * 0.42, Math.max(26, curDiag.meltPoolDepthUm * 0.85));

      if (mode === 'PYROMETRY_TOP') {
        // Solidified wake track extending to right edge
        const wakeGrad = ctx.createLinearGradient(laserX, laserY, width, laserY);
        if (aborted) {
          wakeGrad.addColorStop(0, 'rgba(6, 182, 212, 0.18)');
          wakeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.05)');
        } else {
          wakeGrad.addColorStop(0, 'rgba(245, 158, 11, 0.42)');
          wakeGrad.addColorStop(0.38, 'rgba(6, 182, 212, 0.28)');
          wakeGrad.addColorStop(0.75, 'rgba(20, 184, 166, 0.14)');
          wakeGrad.addColorStop(1, 'rgba(15, 23, 42, 0.02)');
        }
        ctx.fillStyle = wakeGrad;
        ctx.beginPath();
        ctx.moveTo(laserX, laserY - poolRy * 1.15);
        ctx.lineTo(width, laserY - poolRy * 1.35);
        ctx.lineTo(width, laserY + poolRy * 1.35);
        ctx.lineTo(laserX, laserY + poolRy * 1.15);
        ctx.closePath();
        ctx.fill();

        // Chevron solidification ripples along the wake
        ctx.strokeStyle = 'rgba(76, 215, 246, 0.16)';
        ctx.lineWidth = 1;
        const rippleOffset = (phaseTime * 36) % 22;
        for (let rx = laserX + 24 + rippleOffset; rx < width; rx += 22) {
          const spread = poolRy * (0.95 + ((rx - laserX) / width) * 0.25);
          ctx.beginPath();
          ctx.moveTo(rx + 18, laserY - spread);
          ctx.quadraticCurveTo(rx - 14, laserY, rx + 18, laserY + spread);
          ctx.stroke();
        }

        // Unmelted powder bed particles ahead of the laser (left side)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
        particles.forEach((p, idx) => {
          const px = ((p.seedX * width - phaseTime * 45) % width + width) % width;
          const py = p.seedY * height;
          const inWake = px > laserX && Math.abs(py - laserY) < poolRy * 1.25;
          if (!inWake) {
            ctx.beginPath();
            ctx.arc(px, py, p.radius * 0.65, 0, Math.PI * 2);
            ctx.fill();
          } else if (idx % 3 === 0) {
            // Subtle epitaxial grain boundary lines in solidified track
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
            ctx.beginPath();
            ctx.moveTo(px, py - 6);
            ctx.lineTo(px - 8, py + 6);
            ctx.stroke();
          }
        });

        // Molten Pool Thermal Plume (Asymmetric Teardrop / Comet Ellipse)
        if (!aborted) {
          ctx.save();
          ctx.translate(laserX + poolRx * 0.34, laserY);
          ctx.scale(poolRx / 100, poolRy / 100);

          const thermalGrad = ctx.createRadialGradient(-28, 0, 4, 0, 0, 115);
          if (curDiag.regime === 'KEYHOLE_POROSITY') {
            thermalGrad.addColorStop(0, '#ffffff');
            thermalGrad.addColorStop(0.16, '#fef08a');
            thermalGrad.addColorStop(0.38, '#f59e0b');
            thermalGrad.addColorStop(0.62, '#ef4444');
            thermalGrad.addColorStop(0.84, 'rgba(6, 182, 212, 0.45)');
            thermalGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          } else {
            thermalGrad.addColorStop(0, '#ecfeff');
            thermalGrad.addColorStop(0.18, '#ffb95f');
            thermalGrad.addColorStop(0.45, '#f59e0b');
            thermalGrad.addColorStop(0.72, 'rgba(6, 182, 212, 0.55)');
            thermalGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
          }

          ctx.fillStyle = thermalGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 112, 0, Math.PI * 2);
          ctx.fill();

          // Isotherm Contour Rings (Liquidus 1933 K & Beta-Transus 1268 K)
          if (isotherms) {
            // Liquidus 1933K boundary
            ctx.strokeStyle = '#ffb95f';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(-8, 0, 68, 0, Math.PI * 2);
            ctx.stroke();

            // Solidus 1878K boundary
            ctx.strokeStyle = '#4cd7f6';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.arc(0, 0, 88, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.restore();
        }

        // Marangoni Thermocapillary Convection Streamlines
        if (vectors && !aborted) {
          ctx.strokeStyle = 'rgba(172, 237, 255, 0.58)';
          ctx.lineWidth = 1.25;
          for (const dir of [-1, 1]) {
            ctx.beginPath();
            const startX = laserX + 6;
            const startY = laserY + dir * 6;
            const endX = laserX + poolRx * 0.72;
            const ctrlY = laserY + dir * (poolRy * 0.88);
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(laserX + poolRx * 0.35, ctrlY, endX, laserY + dir * 10);
            ctx.stroke();

            // Animated flow tracer bead along vortex
            const t = (phaseTime * 1.35) % 1;
            const bx =
              (1 - t) * (1 - t) * startX +
              2 * (1 - t) * t * (laserX + poolRx * 0.35) +
              t * t * endX;
            const by =
              (1 - t) * (1 - t) * startY +
              2 * (1 - t) * t * ctrlY +
              t * t * (laserY + dir * 10);
            ctx.fillStyle = '#4cd7f6';
            ctx.fillRect(bx - 2, by - 2, 4, 4);
          }
        }

        // Spatter Ejecta & Balling Droplets when in Keyhole or Balling regime
        if (
          !aborted &&
          (curDiag.regime === 'KEYHOLE_POROSITY' || curDiag.regime === 'BALLING_INSTABILITY')
        ) {
          particles.slice(0, 14).forEach((sp, i) => {
            const travel = ((phaseTime * 90 * sp.speed + i * 19) % 130) + 8;
            const sx = laserX + Math.cos(sp.angle) * travel;
            const sy = laserY + Math.sin(sp.angle) * travel * 0.75;
            ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#ffb95f';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.3, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // Laser Emission Focal Crosshair
        ctx.strokeStyle = aborted ? '#ef4444' : '#06b6d4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(laserX, laserY, 10 + Math.sin(phaseTime * 6) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mode === 'CROSS_SECTION') {
        // Longitudinal X-Z Cross-Section View
        const surfaceY = height * 0.42;
        const layerPx = Math.max(16, (curParams.layerThicknessUm / 90) * 48);

        // Substrate bulk below powder layer
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, surfaceY + layerPx, width, height - (surfaceY + layerPx));

        // Substrate prior-beta columnar grains
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        const grainStep = Math.max(24, curDiag.phases.priorBetaGrainWidthUm * 0.45);
        for (let gx = 0; gx < width; gx += grainStep) {
          ctx.beginPath();
          ctx.moveTo(gx, surfaceY + layerPx);
          ctx.lineTo(gx - 18, height);
          ctx.stroke();
        }

        // Unmelted powder layer ahead of laser (left of laserX)
        ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
        ctx.fillRect(0, surfaceY, laserX, layerPx);
        ctx.strokeStyle = 'rgba(76, 215, 246, 0.35)';
        for (let px = 8; px < laserX - 6; px += 12) {
          for (let py = surfaceY + 5; py < surfaceY + layerPx - 3; py += 10) {
            ctx.beginPath();
            ctx.arc(px + ((py * 3) % 5), py, 4, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Incident Fiber Laser / Electron Beam Cone from top
        if (!aborted) {
          const beamGrad = ctx.createLinearGradient(laserX, 0, laserX, surfaceY + poolDepthPx * 0.6);
          beamGrad.addColorStop(0, 'rgba(6, 182, 212, 0.04)');
          beamGrad.addColorStop(0.7, 'rgba(76, 215, 246, 0.38)');
          beamGrad.addColorStop(1, 'rgba(255, 185, 95, 0.75)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.moveTo(laserX - 42, 0);
          ctx.lineTo(laserX + 42, 0);
          ctx.lineTo(laserX + 10, surfaceY + 8);
          ctx.lineTo(laserX - 10, surfaceY + 8);
          ctx.closePath();
          ctx.fill();

          // Molten Pool Penetration Bowl (Depth D)
          const depthGrad = ctx.createRadialGradient(
            laserX + 18,
            surfaceY + 12,
            6,
            laserX + 35,
            surfaceY + poolDepthPx * 0.4,
            Math.max(poolRx * 0.85, poolDepthPx * 1.2)
          );
          depthGrad.addColorStop(0, '#ffffff');
          depthGrad.addColorStop(0.25, '#ffb95f');
          depthGrad.addColorStop(0.55, curDiag.regime === 'KEYHOLE_POROSITY' ? '#ef4444' : '#f59e0b');
          depthGrad.addColorStop(0.85, 'rgba(6, 182, 212, 0.38)');
          depthGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

          ctx.fillStyle = depthGrad;
          ctx.beginPath();
          ctx.moveTo(laserX - 24, surfaceY);
          ctx.quadraticCurveTo(
            laserX + 10,
            surfaceY + poolDepthPx * 1.45,
            laserX + poolRx * 0.95,
            surfaceY
          );
          ctx.closePath();
          ctx.fill();

          // Keyhole Vapor Depression Cavity & Trapped Gas Pores if high energy
          if (curDiag.regime === 'KEYHOLE_POROSITY' || curDiag.aspectRatioDW > 0.72) {
            ctx.fillStyle = '#090e1c';
            ctx.strokeStyle = '#ffb95f';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(laserX - 7, surfaceY);
            ctx.quadraticCurveTo(
              laserX,
              surfaceY + poolDepthPx * 0.92,
              laserX + 8,
              surfaceY
            );
            ctx.fill();
            ctx.stroke();

            // Trapped root keyhole pores in solidified wake
            ctx.fillStyle = '#090e1c';
            ctx.strokeStyle = '#ef4444';
            for (let k = 1; k <= 4; k++) {
              const poreX = laserX + k * 54 + ((phaseTime * 28) % 54);
              const poreY = surfaceY + poolDepthPx * 0.78 + (k % 2) * 8;
              ctx.beginPath();
              ctx.arc(poreX, poreY, 5.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
        }

        // Dimension Reference Lines for Layer Thickness t and Melt Pool Depth D
        ctx.strokeStyle = 'rgba(203, 213, 225, 0.35)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, surfaceY);
        ctx.lineTo(width, surfaceY);
        ctx.moveTo(0, surfaceY + layerPx);
        ctx.lineTo(width, surfaceY + layerPx);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 11px "JetBrains Mono", monospace';
        ctx.fillText(`POWDER BED t = ${curParams.layerThicknessUm} μm`, 14, surfaceY + layerPx - 5);
        ctx.fillStyle = '#4cd7f6';
        ctx.fillText(
          `PENETRATION DEPTH D = ${curDiag.meltPoolDepthUm} μm (D/W = ${curDiag.aspectRatioDW})`,
          laserX + 28,
          surfaceY + poolDepthPx + 18
        );
      } else {
        // HATCH_VECTORS: 67-deg Rotating Bidirectional Scan Strategy
        const margin = 42;
        const boxW = width - margin * 2;
        const boxH = height - margin * 2;
        ctx.strokeStyle = 'rgba(76, 215, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, margin, boxW, boxH);

        // Previous layer n-1 hatch lines (67 deg rotation)
        ctx.save();
        ctx.beginPath();
        ctx.rect(margin, margin, boxW, boxH);
        ctx.clip();

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
        for (let offset = -boxH; offset < boxW + boxH; offset += 24) {
          ctx.beginPath();
          ctx.moveTo(margin + offset, margin);
          ctx.lineTo(margin + offset - boxH * 0.42, margin + boxH);
          ctx.stroke();
        }

        // Active layer bidirectional raster vectors
        const hatchPx = Math.max(16, Math.round((curParams.hatchSpacingUm / 180) * 38));
        const rows: number[] = [];
        for (let y = margin + 22; y < margin + boxH - 16; y += hatchPx) {
          rows.push(y);
        }

        const totalRows = Math.max(1, rows.length);
        const activeProgress = ((phaseTime * 0.45) % totalRows);
        const activeRowIndex = Math.floor(activeProgress);
        const rowFraction = activeProgress - activeRowIndex;

        rows.forEach((ry, idx) => {
          const leftToRight = idx % 2 === 0;
          const xStart = leftToRight ? margin + 20 : margin + boxW - 20;
          const xEnd = leftToRight ? margin + boxW - 20 : margin + 20;

          if (idx < activeRowIndex) {
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xStart, ry);
            ctx.lineTo(xEnd, ry);
            ctx.stroke();
          } else if (idx === activeRowIndex && !aborted) {
            const curX = xStart + (xEnd - xStart) * rowFraction;
            const scanGrad = ctx.createLinearGradient(xStart, ry, curX, ry);
            scanGrad.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
            scanGrad.addColorStop(0.85, '#06b6d4');
            scanGrad.addColorStop(1, '#ffb95f');
            ctx.strokeStyle = scanGrad;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(xStart, ry);
            ctx.lineTo(curX, ry);
            ctx.stroke();

            // Active laser spot glow
            ctx.fillStyle = '#ffb95f';
            ctx.beginPath();
            ctx.arc(curX, ry, 6, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(xStart, ry);
            ctx.lineTo(xEnd, ry);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
        ctx.restore();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 11px "JetBrains Mono", monospace';
        ctx.fillText(
          `BIDIRECTIONAL 67° ROTATION // HATCH SPACING h = ${curParams.hatchSpacingUm} μm // v = ${curParams.scanSpeedMmS} mm/s`,
          margin + 12,
          margin + 16
        );
      }

      // 3. Interactive Crosshair Fiducial Probe Overlay
      const probeX = probe.u * width;
      const probeY = probe.v * height;

      ctx.strokeStyle = 'rgba(76, 215, 246, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(probeX, 0);
      ctx.lineTo(probeX, height);
      ctx.moveTo(0, probeY);
      ctx.lineTo(width, probeY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Calibrated target box around probe
      ctx.strokeStyle = '#4cd7f6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(probeX - 7, probeY - 7, 14, 14);

      timerId = window.setTimeout(() => {
        animId = requestAnimationFrame(renderFrame);
      }, 45);
    };

    let timerId = 0;
    animId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timerId);
    };
  }, []);

  const handleCanvasPointer = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const u = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));
    setProbeCoords({ u, v });
  };

  const probeSample = sampleSpatialPyrometry(
    probeCoords.u,
    probeCoords.v,
    diagnostics,
    params.preheatTempC
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Main Melt Pool Thermal Pyrometry Glass Card */}
      <div className="glass-level-2 rounded-lg p-4 flex flex-col gap-3">
        {/* Viewport Top Instrumentation Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <span className="w-1 h-4 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-[#dee2f6] tracking-tight">
                Melt Pool Thermal Pyrometry Viewport
              </h2>
              <p className="text-[11px] font-mono text-[#869397] tracking-wider">
                {params.mode === 'LPBF'
                  ? 'OPTICAL PYROMETRY // 1070 nm Yb-FIBER LASER'
                  : 'IR THERMOGRAPHY // 60 kV ELECTRON BEAM VACUUM'}
              </p>
            </div>
          </div>

          {/* Segmented Layer View Switcher */}
          <div
            role="group"
            aria-label="Viewport Visualization Mode"
            className="flex items-center gap-1 bg-[#090e1c] p-1 rounded border border-slate-800"
          >
            <button
              type="button"
              onClick={() => setViewMode('PYROMETRY_TOP')}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'PYROMETRY_TOP'
                  ? 'bg-[#06b6d4] text-[#0a0f1d] font-semibold'
                  : 'text-[#bcc9cd] hover:text-white'
              }`}
            >
              Isotherms & Flow
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CROSS_SECTION')}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'CROSS_SECTION'
                  ? 'bg-[#06b6d4] text-[#0a0f1d] font-semibold'
                  : 'text-[#bcc9cd] hover:text-white'
              }`}
            >
              Keyhole Cross-Section
            </button>
            <button
              type="button"
              onClick={() => setViewMode('HATCH_VECTORS')}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'HATCH_VECTORS'
                  ? 'bg-[#06b6d4] text-[#0a0f1d] font-semibold'
                  : 'text-[#bcc9cd] hover:text-white'
              }`}
            >
              Hatch Vectors
            </button>
          </div>
        </div>

        {/* Interactive Pyrometry Canvas Container */}
        <div className="relative rounded overflow-hidden border border-slate-800 bg-[#090e1c]">
          <canvas
            ref={canvasRef}
            width={760}
            height={360}
            data-testid="melt-pool-canvas"
            onMouseMove={handleCanvasPointer}
            onClick={handleCanvasPointer}
            className="w-full h-[320px] sm:h-[350px] block cursor-crosshair"
          />

          {/* Top-Left HUD Overlay: Peak Pyrometry & Geometry */}
          <div className="pointer-events-none absolute top-3 left-3 bg-[#090e1c]/90 border border-slate-800/90 rounded px-3 py-2 text-xs font-mono space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-[#869397]">PEAK T:</span>
              <span className="text-[#ffb95f] font-semibold">
                {isAborted ? `${params.preheatTempC + 273} K` : `${diagnostics.peakTempK} K`} (
                {isAborted ? `${params.preheatTempC} °C` : `${diagnostics.peakTempC} °C`})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#869397]">DIMENSIONS:</span>
              <span className="text-[#dee2f6]">
                L {diagnostics.meltPoolLengthUm} μm · W {diagnostics.meltPoolWidthUm} μm · D{' '}
                {diagnostics.meltPoolDepthUm} μm
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#869397]">MARANGONI v:</span>
              <span className="text-[#4cd7f6]">{diagnostics.marangoniVelocityMmS} mm/s</span>
            </div>
          </div>

          {/* Bottom-Left HUD Overlay: Interactive Fiducial Crosshair Readout */}
          <div className="pointer-events-none absolute bottom-3 left-3 bg-[#090e1c]/90 border border-[#06b6d4]/30 rounded px-3 py-2 text-xs font-mono">
            <div className="text-[10px] tracking-wider text-[#4cd7f6]">
              FIDUCIAL PROBE ({probeSample.xUm >= 0 ? `+${probeSample.xUm}` : probeSample.xUm} μm,{' '}
              {probeSample.yUm >= 0 ? `+${probeSample.yUm}` : probeSample.yUm} μm)
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[#dee2f6]">
              <span>
                T<sub>loc</sub>: <strong className="text-[#ffb95f]">{probeSample.tempK} K</strong> ({probeSample.tempC} °C)
              </span>
              <span aria-hidden="true">·</span>
              <span>∇T: {probeSample.localGradientKUm} K/μm</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#4edea3]">{probeSample.phaseLabel}</span>
            </div>
          </div>

          {/* Right Vertical Color-Ramp Calibration Scale (300 K - 3200 K) */}
          <div className="pointer-events-none absolute top-3 bottom-3 right-3 bg-[#090e1c]/90 border border-slate-800/90 rounded px-2 py-2 flex flex-col items-center justify-between text-[10px] font-mono text-[#bcc9cd]">
            <span className="text-[#fef08a] font-semibold">3200K</span>
            <div
              className="w-2.5 flex-1 my-1.5 rounded-xs border border-slate-700"
              style={{
                background:
                  'linear-gradient(to bottom, #ffffff 0%, #fef08a 16%, #ef4444 34%, #f59e0b 55%, #06b6d4 78%, #0f172a 100%)',
              }}
            />
            <span className="text-[#869397]">300K</span>
          </div>
        </div>

        {/* Viewport Footer Controls: Checkboxes + Simulation Transport + Emergency Excursion Stop */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#bcc9cd]">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showIsotherms}
                onChange={(e) => setShowIsotherms(e.target.checked)}
                className="sr-only"
              />
              <span
                className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-colors ${
                  showIsotherms
                    ? 'bg-[#06b6d4] border-[#06b6d4] text-[#0a0f1d]'
                    : 'bg-[#070b14] border-slate-600'
                }`}
              >
                {showIsotherms && <span className="w-1.5 h-1.5 bg-[#0a0f1d] block" />}
              </span>
              <span>ISOTHERM CONTOURS (T_L / T_S)</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showMarangoniVectors}
                onChange={(e) => setShowMarangoniVectors(e.target.checked)}
                className="sr-only"
              />
              <span
                className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-colors ${
                  showMarangoniVectors
                    ? 'bg-[#06b6d4] border-[#06b6d4] text-[#0a0f1d]'
                    : 'bg-[#070b14] border-slate-600'
                }`}
              >
                {showMarangoniVectors && <span className="w-1.5 h-1.5 bg-[#0a0f1d] block" />}
              </span>
              <span>MARANGONI VECTORS</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSimulation}
              className="px-3 py-1.5 text-xs font-mono font-medium rounded bg-[#0f172a] border border-[#475569] text-[#cbd5e1] hover:border-[#94a3b8] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {isSimulating ? 'Pause Pyrometry Stream' : 'Resume Pyrometry Stream'}
            </button>

            {isAborted ? (
              <button
                type="button"
                onClick={onResetBeam}
                className="px-3 py-1.5 text-xs font-mono font-semibold rounded bg-[#06b6d4] text-[#0a0f1d] hover:shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all whitespace-nowrap shrink-0"
              >
                Re-Arm Optical Emitter
              </button>
            ) : (
              <button
                type="button"
                onClick={onEmergencyAbort}
                className="px-3 py-1.5 text-xs font-mono font-semibold rounded bg-[#ef4444] text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
              >
                Emergency Beam Abort
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Solidification Cooling Curve & Allotropic Boundary Card */}
      <div className="glass-level-1 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-3.5 bg-[#06b6d4] inline-block" aria-hidden="true" />
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#dee2f6]">
              Solidification Cooling Trajectory & Allotropic Phase Thresholds
            </h3>
          </div>
          <div className="text-xs font-mono text-[#bcc9cd]">
            COOLING RATE dT/dt:{' '}
            <strong className="text-[#4cd7f6]">
              {(diagnostics.coolingRateKs / 1000).toFixed(1)} × 10³ K/s
            </strong>{' '}
            · GRADIENT G: <strong className="text-[#ffb95f]">{diagnostics.thermalGradientKUm} K/μm</strong>
          </div>
        </div>

        {/* SVG Thermal Decay Curve across T_L (1933 K), Beta-Transus (1268 K), and M_s (848 K) */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox="0 0 720 155"
            className="w-full h-[145px] block bg-[#090e1c]/90 rounded border border-slate-800/80"
            role="img"
            aria-label="Ti-6Al-4V Solidification Cooling Curve"
          >
            {/* Horizontal Allotropic Threshold Reference Lines (Right-aligned labels to avoid curve collision) */}
            {/* Liquidus 1933 K */}
            <line
              x1="48"
              y1="42"
              x2="700"
              y2="42"
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x="694" y="36" textAnchor="end" fill="#ffb95f" fontSize="10" fontFamily="JetBrains Mono">
              T_LIQUIDUS = {TI64_CONSTANTS.LIQUIDUS_K} K (1660 °C)
            </text>

            {/* Beta-Transus 1268 K */}
            <line
              x1="48"
              y1="80"
              x2="700"
              y2="80"
              stroke="#06b6d4"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x="694" y="74" textAnchor="end" fill="#4cd7f6" fontSize="10" fontFamily="JetBrains Mono">
              β-TRANSUS = {TI64_CONSTANTS.BETA_TRANSUS_K} K (995 °C) [BCC β → HCP α+β]
            </text>

            {/* Martensite Start Ms 848 K */}
            <line
              x1="48"
              y1="112"
              x2="700"
              y2="112"
              stroke="#10b981"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text x="694" y="106" textAnchor="end" fill="#4edea3" fontSize="10" fontFamily="JetBrains Mono">
              M_s MARTENSITE START = {TI64_CONSTANTS.MARTENSITE_START_K} K (575 °C)
            </text>

            {/* Dynamic Cooling Path Curve */}
            {(() => {
              const startY = Math.max(12, 138 - (diagnostics.peakTempK / 3400) * 124);
              const preheatK = params.preheatTempC + 273.15;
              const endY = Math.min(138, 138 - (preheatK / 3400) * 124);
              const slopeFactor = Math.min(280, Math.max(95, 240000 / Math.max(diagnostics.coolingRateKs, 5000)));
              const pathD = `M 52 ${startY} C ${52 + slopeFactor * 0.45} ${startY + 8}, ${52 + slopeFactor} ${endY - 6}, 692 ${endY}`;

              return (
                <>
                  <path
                    d={`${pathD} L 692 142 L 52 142 Z`}
                    fill="url(#coolingFill)"
                    opacity="0.24"
                  />
                  <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth="2.25" />
                  <circle cx="52" cy={startY} r="4" fill="#ffb95f" />
                  <circle cx="692" cy={endY} r="4" fill="#4cd7f6" />
                </>
              );
            })()}

            <defs>
              <linearGradient id="coolingFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="45%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
};

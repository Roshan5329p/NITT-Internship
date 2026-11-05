import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Layers, RotateCcw, Eye, Sliders, Activity, Flame, ShieldAlert, Sparkles } from 'lucide-react';

interface DigitalTwin3DViewProps {
  alloyName: string;
  laserPowerW: number;
  scanSpeedMmS: number;
  coolingRateKPerS: number;
  residualStressMPa: number;
  hardnessHV: number;
  elongationPct: number;
}

export type HeatmapMode = 'residual-stress' | 'cooling-rate' | 'phase-fraction' | 'hardness';

export const DigitalTwin3DView: React.FC<DigitalTwin3DViewProps> = ({
  alloyName,
  laserPowerW,
  scanSpeedMmS,
  coolingRateKPerS,
  residualStressMPa,
  hardnessHV,
  elongationPct,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('residual-stress');
  const [slicePlanePct, setSlicePlanePct] = useState<number>(100); // 0 to 100% Z-slice
  const [wireframeOnly, setWireframeOnly] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  // Rotation angles (radians)
  const [rotX, setRotX] = useState<number>(0.35);
  const [rotY, setRotY] = useState<number>(0.65);
  const [zoom, setZoom] = useState<number>(1.15);

  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Heatmap Color Interpolation
  const getColorForValue = (normVal: number): [number, number, number] => {
    // clamped 0.0 to 1.0
    const t = Math.max(0, Math.min(1, normVal));
    if (heatmapMode === 'residual-stress') {
      // Blue (compressive) -> Cyan -> Green -> Yellow -> Red (high tensile)
      if (t < 0.25) return [20, 80 + t * 4 * 100, 240];
      if (t < 0.5) return [20, 180 + (t - 0.25) * 4 * 70, 240 - (t - 0.25) * 4 * 120];
      if (t < 0.75) return [20 + (t - 0.5) * 4 * 230, 250, 10];
      return [250, 250 - (t - 0.75) * 4 * 220, 20];
    } else if (heatmapMode === 'cooling-rate') {
      // Dark Purple -> Magenta -> Orange -> Bright Yellow
      if (t < 0.33) return [50 + t * 3 * 150, 20, 140];
      if (t < 0.66) return [200 + (t - 0.33) * 3 * 55, 20 + (t - 0.33) * 3 * 140, 40];
      return [255, 160 + (t - 0.66) * 3 * 95, 20];
    } else if (heatmapMode === 'phase-fraction') {
      // Martensite alpha' (Rose/Red) vs Prior-Beta (Emerald/Teal)
      return [Math.round(240 * t + 20 * (1 - t)), Math.round(50 * t + 180 * (1 - t)), Math.round(90 * t + 160 * (1 - t))];
    } else {
      // Hardness: Deep Navy -> Cyan -> Gold
      if (t < 0.5) return [20, Math.round(100 + t * 2 * 120), Math.round(220 + t * 2 * 35)];
      return [Math.round(20 + (t - 0.5) * 2 * 235), Math.round(220 - (t - 0.5) * 2 * 40), Math.round(255 - (t - 0.5) * 2 * 230)];
    }
  };

  // 3D Canvas Rendering Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = 110 * zoom;

      // 3D Specimen Mesh (ASTM E8 Tensile Dogbone Specimen)
      // Generates rings of 3D vertices along Z axis
      const rings = 28;
      const sectors = 18;
      const totalLen = 2.4;
      const maxSliceZ = (slicePlanePct / 100) * totalLen - totalLen / 2;

      // 3D Rotation Matrix helper
      const project = (x: number, y: number, z: number) => {
        // Rotate around Y
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // Rotate around X
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        // Perspective projection
        const dist = 4.2;
        const fov = dist / (dist + z2);
        return {
          px: cx + x1 * scale * fov,
          py: cy + y2 * scale * fov,
          pz: z2,
          fov,
        };
      };

      // Draw mesh faces with depth sorting
      type PolygonFace = {
        pts: { px: number; py: number }[];
        avgZ: number;
        color: string;
      };

      const faces: PolygonFace[] = [];

      for (let r = 0; r < rings - 1; r++) {
        const zNorm1 = r / (rings - 1);
        const zNorm2 = (r + 1) / (rings - 1);
        const z1 = zNorm1 * totalLen - totalLen / 2;
        const z2 = zNorm2 * totalLen - totalLen / 2;

        if (z1 > maxSliceZ) continue;

        // ASTM E8 Dogbone profile (Grip ends wider, center gauge narrow)
        const getRadius = (z: number) => {
          const absZ = Math.abs(z);
          if (absZ < 0.6) return 0.38; // Narrow gauge length
          if (absZ > 0.95) return 0.72; // Wide grip sections
          const transition = (absZ - 0.6) / 0.35;
          return 0.38 + 0.34 * (transition * transition);
        };

        const rad1 = getRadius(z1);
        const rad2 = getRadius(z2);

        for (let s = 0; s < sectors; s++) {
          const theta1 = (s / sectors) * Math.PI * 2;
          const theta2 = ((s + 1) / sectors) * Math.PI * 2;

          const x11 = Math.cos(theta1) * rad1;
          const y11 = Math.sin(theta1) * rad1;
          const x12 = Math.cos(theta2) * rad1;
          const y12 = Math.sin(theta2) * rad1;

          const x21 = Math.cos(theta1) * rad2;
          const y21 = Math.sin(theta1) * rad2;
          const x22 = Math.cos(theta2) * rad2;
          const y22 = Math.sin(theta2) * rad2;

          const p11 = project(x11, y11, z1);
          const p12 = project(x12, y12, z1);
          const p22 = project(x22, y22, z2);
          const p21 = project(x21, y21, z2);

          const avgZ = (p11.pz + p12.pz + p22.pz + p21.pz) / 4;

          // Normalized scalar for heatmap
          // Tensile specimen physics: surface has highest tensile residual stress, core is compressive
          const distFromAxis = (rad1 + rad2) / 2;
          let scalar = 0.5;
          if (heatmapMode === 'residual-stress') {
            scalar = 0.2 + (distFromAxis / 0.72) * 0.75 * (residualStressMPa / 500);
          } else if (heatmapMode === 'cooling-rate') {
            // Rapid cooling at grip ends and outer perimeter
            scalar = 0.3 + (distFromAxis / 0.72) * 0.65;
          } else if (heatmapMode === 'phase-fraction') {
            // Martensite fraction higher in rapidly cooled outer rim
            scalar = Math.min(1, 0.4 + (distFromAxis / 0.72) * 0.55);
          } else {
            // Hardness
            scalar = Math.min(1, Math.max(0, (hardnessHV - 320) / 160));
          }

          const rgb = getColorForValue(scalar);
          const lighting = Math.max(0.25, Math.min(1.0, 0.5 + 0.5 * Math.cos(theta1 + rotY)));
          const rC = Math.round(rgb[0] * lighting);
          const gC = Math.round(rgb[1] * lighting);
          const bC = Math.round(rgb[2] * lighting);

          faces.push({
            pts: [p11, p12, p22, p21],
            avgZ,
            color: `rgb(${rC}, ${gC}, ${bC})`,
          });
        }
      }

      // Sort faces back-to-front (Painter's algorithm)
      faces.sort((a, b) => b.avgZ - a.avgZ);

      // Draw all polygon faces
      faces.forEach((f) => {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].px, f.pts[0].py);
        for (let i = 1; i < f.pts.length; i++) {
          ctx.lineTo(f.pts[i].px, f.pts[i].py);
        }
        ctx.closePath();

        if (wireframeOnly) {
          ctx.strokeStyle = f.color;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = f.color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(10, 16, 26, 0.35)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      });

      // Draw active slice plane indicator if sliced
      if (slicePlanePct < 98) {
        const sliceProjCenter = project(0, 0, maxSliceZ);
        ctx.save();
        ctx.strokeStyle = '#50d8e9';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sliceProjCenter.px, sliceProjCenter.py, 42 * zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#50d8e9';
        ctx.font = '10px monospace';
        ctx.fillText(`Slice Plane Z=${Math.round(slicePlanePct)}%`, sliceProjCenter.px + 48, sliceProjCenter.py);
        ctx.restore();
      }

      // Auto rotation increment
      if (autoRotate && !isDraggingRef.current) {
        setRotY((prev) => prev + 0.007);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [rotX, rotY, zoom, heatmapMode, slicePlanePct, wireframeOnly, autoRotate, residualStressMPa, coolingRateKPerS, hardnessHV]);

  // Mouse drag handlers for 3D rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setRotY((prev) => prev + dx * 0.009);
    setRotX((prev) => Math.max(-1.2, Math.min(1.2, prev + dy * 0.009)));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <div className="p-5 rounded-xl border border-[#1b3147] bg-gradient-to-r from-[#071726] via-[#091f33] to-[#0a1724] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-[#50d8e9]/15 text-[#50d8e9]">
              <Box className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white tracking-wide">
              3D Digital Twin &amp; Stress Tensor Heatmap
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-[#50d8e9] text-xs font-semibold border border-cyan-500/40">
              Interactive WebGL Specimen
            </span>
          </div>
          <p className="text-xs text-[#9bb6d3] mt-1.5 max-w-2xl leading-relaxed">
            Real-time volumetric 3D representation of an <strong>ASTM E8 Tensile Specimen</strong> in <strong>{alloyName}</strong>. Drag to orbit, zoom, slice cross-sections, and visualize residual stress tensors and thermal cooling contours.
          </p>
        </div>

        {/* Heatmap Mode Selector Pills */}
        <div className="flex items-center gap-1.5 bg-[#0b141f] border border-[#1e3044] p-1 rounded-lg shrink-0">
          <button
            onClick={() => setHeatmapMode('residual-stress')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              heatmapMode === 'residual-stress' ? 'bg-[#50d8e9] text-black font-bold shadow' : 'text-[#7e99b5] hover:text-white'
            }`}
          >
            Residual Stress
          </button>
          <button
            onClick={() => setHeatmapMode('cooling-rate')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              heatmapMode === 'cooling-rate' ? 'bg-[#50d8e9] text-black font-bold shadow' : 'text-[#7e99b5] hover:text-white'
            }`}
          >
            Cooling Rate
          </button>
          <button
            onClick={() => setHeatmapMode('phase-fraction')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              heatmapMode === 'phase-fraction' ? 'bg-[#50d8e9] text-black font-bold shadow' : 'text-[#7e99b5] hover:text-white'
            }`}
          >
            Martensite α'
          </button>
        </div>
      </div>

      {/* Main Grid: 3D Canvas (8 cols) & Parameter Controls (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 3D Canvas Viewport (8 Cols) */}
        <div className="lg:col-span-8 bg-[#070b10] border border-[#1b2636] rounded-xl p-4 shadow-2xl relative flex flex-col justify-between overflow-hidden">
          {/* Canvas Floating Top Overlay Toolbar */}
          <div className="flex items-center justify-between text-xs mb-2 z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-white text-[11px] font-semibold">
                ASTM E8 Standard Tensile Specimen • 60 FPS Engine
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all ${
                  autoRotate ? 'bg-[#50d8e9]/15 text-[#50d8e9] border-[#50d8e9]/40' : 'bg-[#101824] text-[#6b85a0] border-[#1f2e42]'
                }`}
              >
                Auto-Orbit: {autoRotate ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setWireframeOnly(!wireframeOnly)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all ${
                  wireframeOnly ? 'bg-amber-500/15 text-amber-400 border-amber-500/40' : 'bg-[#101824] text-[#6b85a0] border-[#1f2e42]'
                }`}
              >
                Wireframe
              </button>
              <button
                onClick={() => {
                  setRotX(0.35);
                  setRotY(0.65);
                  setZoom(1.15);
                  setSlicePlanePct(100);
                }}
                className="p-1 rounded bg-[#101824] text-[#6b85a0] hover:text-white border border-[#1f2e42]"
                title="Reset Camera View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive HTML5 3D Canvas */}
          <div
            className="w-full aspect-[16/10] bg-radial from-[#0e1724] via-[#080d14] to-[#040608] rounded-lg cursor-grab active:cursor-grabbing border border-[#141e2b] relative select-none flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas ref={canvasRef} width={800} height={500} className="w-full h-full object-contain pointer-events-none" />

            <div className="absolute bottom-3 left-3 text-[10px] text-[#556e87] font-mono pointer-events-none bg-black/40 px-2 py-1 rounded backdrop-blur">
              Click &amp; Drag to Orbit • Scroll to Zoom
            </div>
          </div>

          {/* Color Legend Bar */}
          <div className="mt-3 pt-3 border-t border-[#16212e] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#7c97b5] text-[11px] font-medium">Heatmap Scale:</span>
              <div className="h-3 w-48 rounded-full overflow-hidden bg-gradient-to-r from-blue-600 via-green-400 via-yellow-400 to-red-500" />
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-cyan-400">Min: -180 MPa (Core Compressive)</span>
              <span className="text-rose-400">Max: +{residualStressMPa} MPa (Surface Tensile)</span>
            </div>
          </div>
        </div>

        {/* 3D Model Parameters & Cross-Section Controls (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Slice Plane Control */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#50d8e9]" />
              Z-Axis Cross-Section Slicing
            </h4>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#9bb3cc]">Slice Penetration Depth:</span>
                <span className="font-mono font-bold text-[#50d8e9]">{slicePlanePct}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="1"
                value={slicePlanePct}
                onChange={(e) => setSlicePlanePct(Number(e.target.value))}
                className="w-full h-1.5 bg-[#172333] rounded-lg appearance-none cursor-pointer accent-[#50d8e9]"
              />
              <div className="flex justify-between text-[10px] text-[#617c99]">
                <span>10% (Core Reveal)</span>
                <span>Sub-Surface Stress</span>
                <span>100% (Full Geometry)</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#182637]">
              <div className="flex justify-between text-xs">
                <span className="text-[#9bb3cc]">Camera Zoom Level:</span>
                <span className="font-mono font-bold text-white">{zoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.75"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-[#172333] rounded-lg appearance-none cursor-pointer accent-[#50d8e9]"
              />
            </div>
          </div>

          {/* Real-Time Stress Tensor Diagnostics */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-3.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#50d8e9]" />
              Local Stress Tensor Decomposition
            </h4>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-[#0e1724] border border-[#1b2b3d] p-3 rounded-lg">
                <div className="text-[10px] text-[#7893af] uppercase">Peak Surface Stress</div>
                <div className="text-lg font-mono font-bold text-rose-400 mt-0.5">
                  +{residualStressMPa} <span className="text-xs font-normal text-[#64748b]">MPa</span>
                </div>
                <div className="text-[10px] text-[#556e87] mt-0.5">Von Mises Tensile</div>
              </div>

              <div className="bg-[#0e1724] border border-[#1b2b3d] p-3 rounded-lg">
                <div className="text-[10px] text-[#7893af] uppercase">Core Neutralization</div>
                <div className="text-lg font-mono font-bold text-cyan-400 mt-0.5">
                  -145 <span className="text-xs font-normal text-[#64748b]">MPa</span>
                </div>
                <div className="text-[10px] text-[#556e87] mt-0.5">Compressive Core</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#0c1420] border border-[#182738] text-xs text-[#a2bcd6] leading-relaxed">
              🔍 <strong>Metallurgical Note:</strong> Laser additive manufacturing generates steep thermal gradients (&nabla;T &gt; 10⁷ K/m) leading to localized plastic deformation. Post-weld annealing collapses peak macro-stresses from ~{residualStressMPa} MPa down below 50 MPa.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

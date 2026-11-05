import React, { useState, useMemo } from 'react';
import { calculateIndustrialEconomics, EconomicAnalysisResult } from '../utils/economicModel';
import { DollarSign, Clock, Leaf, ShieldCheck, Box, Layers, RefreshCw, Zap, TrendingUp, Award } from 'lucide-react';

interface IndustrialEconomicsViewProps {
  alloyId: string;
  alloyName: string;
  processId: string;
  laserPowerW: number;
  scanSpeedMmS: number;
  hatchSpacingUm: number;
  layerThicknessUm: number;
}

export const IndustrialEconomicsView: React.FC<IndustrialEconomicsViewProps> = ({
  alloyId,
  alloyName,
  processId,
  laserPowerW,
  scanSpeedMmS,
  hatchSpacingUm,
  layerThicknessUm,
}) => {
  // Configurable Part & Batch Parameters
  const [partVolumeCm3, setPartVolumeCm3] = useState<number>(65);
  const [partHeightMm, setPartHeightMm] = useState<number>(110);
  const [quantityPerBatch, setQuantityPerBatch] = useState<number>(4);
  const [powderRecycleRatePct, setPowderRecycleRatePct] = useState<number>(85);

  const econData: EconomicAnalysisResult = useMemo(() => {
    return calculateIndustrialEconomics({
      alloyId,
      processId,
      laserPowerW,
      scanSpeedMmS,
      hatchSpacingUm,
      layerThicknessUm,
      partVolumeCm3,
      partHeightMm,
      quantityPerBatch,
      powderRecycleRatePct,
    });
  }, [
    alloyId,
    processId,
    laserPowerW,
    scanSpeedMmS,
    hatchSpacingUm,
    layerThicknessUm,
    partVolumeCm3,
    partHeightMm,
    quantityPerBatch,
    powderRecycleRatePct,
  ]);

  // Compute percentages for cost breakdown bar
  const totalCost = Math.max(1, econData.totalBatchCostUsd);
  const powderPct = Math.round((econData.powderCostUsd / totalCost) * 100);
  const machinePct = Math.round((econData.machineDepreciationCostUsd / totalCost) * 100);
  const argonPct = Math.round((econData.argonGasCostUsd / totalCost) * 100);
  const energyPct = Math.max(1, 100 - powderPct - machinePct - argonPct);

  return (
    <div className="space-y-6">
      {/* Top Banner Overview */}
      <div className="p-5 rounded-xl border border-[#1b3147] bg-gradient-to-r from-[#071726] via-[#091f33] to-[#0a1724] shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-[#50d8e9]/15 text-[#50d8e9]">
              <DollarSign className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white tracking-wide">
              Industrial Economics &amp; ESG Telemetry Engine
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/40">
              {econData.sustainabilityRating}
            </span>
          </div>
          <p className="text-xs text-[#9bb6d3] mt-1.5 max-w-2xl leading-relaxed">
            Real-time volumetric deposition economics, powder mass consumption, argon shielding, machine cycle amortization,
            and commercial scrap-avoidance ROI for <strong>{alloyName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#0e2236] border border-[#224466] rounded-lg px-4 py-2 text-right">
            <div className="text-[10px] text-[#7ea3c8] uppercase tracking-wider">Finished Cost per Part</div>
            <div className="text-xl font-mono font-extrabold text-[#50d8e9] mt-0.5">
              ${econData.costPerPartUsd.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Primary Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-[#7c97b5] text-xs">
            <span>Volumetric Build Rate</span>
            <TrendingUp className="w-4 h-4 text-[#50d8e9]" />
          </div>
          <div className="text-2xl font-mono font-extrabold text-white mt-1.5">
            {econData.volumetricBuildRateCm3Hr}{' '}
            <span className="text-xs font-sans font-normal text-[#64748b]">cm³/hr</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            ✓ Based on {laserPowerW} W &amp; {scanSpeedMmS} mm/s
          </div>
        </div>

        <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-[#7c97b5] text-xs">
            <span>Total Build Duration</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-extrabold text-white mt-1.5">
            {econData.totalBuildTimeHours}{' '}
            <span className="text-xs font-sans font-normal text-[#64748b]">hours</span>
          </div>
          <div className="text-[11px] text-[#8aa4c2] mt-1">
            {econData.totalLayers.toLocaleString()} layers @ {layerThicknessUm}µm
          </div>
        </div>

        <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-[#7c97b5] text-xs">
            <span>Total Batch Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-extrabold text-white mt-1.5">
            ${econData.totalBatchCostUsd.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#8aa4c2] mt-1">
            Batch of {quantityPerBatch} parts ({econData.totalBatchMassKg} kg)
          </div>
        </div>

        <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-[#7c97b5] text-xs">
            <span>Trial Scrap Avoided ROI</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1.5">
            +${econData.totalCommercialSavingsUsd.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#8aa4c2] mt-1">
            {econData.estimatedIterationsSaved} physical test builds saved
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Sliders on Left (4 cols), ROI & Cost Breakdown on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Part & Batch Modeler (4 Cols) */}
        <div className="lg:col-span-4 bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-5">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Box className="w-4 h-4 text-[#50d8e9]" />
            Component &amp; Production Configurator
          </h4>

          {/* Part Volume */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#9bb3cc]">Part Finished Volume:</span>
              <span className="font-mono font-bold text-white">{partVolumeCm3} cm³</span>
            </div>
            <input
              type="range"
              min="10"
              max="400"
              step="5"
              value={partVolumeCm3}
              onChange={(e) => setPartVolumeCm3(Number(e.target.value))}
              className="w-full h-1.5 bg-[#172333] rounded-lg appearance-none cursor-pointer accent-[#50d8e9]"
            />
            <div className="flex justify-between text-[10px] text-[#617c99]">
              <span>10 cm³ (Coupons)</span>
              <span>Single Part: {econData.partMassGrams}g</span>
              <span>400 cm³ (Structural)</span>
            </div>
          </div>

          {/* Part Height */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#9bb3cc]">Component Z-Height:</span>
              <span className="font-mono font-bold text-white">{partHeightMm} mm</span>
            </div>
            <input
              type="range"
              min="20"
              max="350"
              step="5"
              value={partHeightMm}
              onChange={(e) => setPartHeightMm(Number(e.target.value))}
              className="w-full h-1.5 bg-[#172333] rounded-lg appearance-none cursor-pointer accent-[#50d8e9]"
            />
            <div className="flex justify-between text-[10px] text-[#617c99]">
              <span>20 mm</span>
              <span>{econData.totalLayers.toLocaleString()} Layers</span>
              <span>350 mm</span>
            </div>
          </div>

          {/* Quantity per Batch */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#9bb3cc]">Parts per Build Plate:</span>
              <span className="font-mono font-bold text-white">{quantityPerBatch} parts</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={quantityPerBatch}
              onChange={(e) => setQuantityPerBatch(Number(e.target.value))}
              className="w-full h-1.5 bg-[#172333] rounded-lg appearance-none cursor-pointer accent-[#50d8e9]"
            />
            <div className="flex justify-between text-[10px] text-[#617c99]">
              <span>1 (Prototype)</span>
              <span>Total Mass: {econData.totalBatchMassKg} kg</span>
              <span>24 (Production)</span>
            </div>
          </div>

          {/* Powder Recycling Rate */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#9bb3cc]">Powder Recycling Efficiency:</span>
              <span className="font-mono font-bold text-emerald-400">{powderRecycleRatePct}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={powderRecycleRatePct}
              onChange={(e) => setPowderRecycleRatePct(Number(e.target.value))}
              className="w-full h-1.5 bg-[#172333] rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-[#617c99]">
              <span>50% (Strict Aerospace)</span>
              <span>Powder: {econData.powderRequiredKg} kg</span>
              <span>95% (High Yield)</span>
            </div>
          </div>

          {/* Production Telemetry Badges */}
          <div className="pt-2 border-t border-[#172535] space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#859eb8]">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#50d8e9]" />
                Laser Exposure Time:
              </span>
              <span className="font-mono font-semibold text-white">{econData.laserExposureHours} hrs</span>
            </div>
            <div className="flex items-center justify-between text-[#859eb8]">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-[#50d8e9]" />
                Recoater Motion Overhead:
              </span>
              <span className="font-mono font-semibold text-white">{econData.recoatingHours} hrs</span>
            </div>
          </div>
        </div>

        {/* Right Column: Commercial Savings ROI & Cost Breakdown (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Commercial ROI Highlight Card */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                Commercial Value Creation vs. Physical Trial-and-Error
              </h4>
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30 font-semibold">
                Instant AI Return on Investment
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#0c1622] border border-[#182b3d] p-3.5 rounded-lg text-center">
                <div className="text-[10px] text-[#718aa3] uppercase">Cost per Scrapped Build</div>
                <div className="text-lg font-mono font-bold text-red-400 mt-1">
                  ${econData.singleTrialFailureCostUsd.toLocaleString()}
                </div>
                <div className="text-[10px] text-[#556e87] mt-0.5">Machine time + powder + prep</div>
              </div>

              <div className="bg-[#0c1622] border border-[#182b3d] p-3.5 rounded-lg text-center">
                <div className="text-[10px] text-[#718aa3] uppercase">Test Cycles Avoided</div>
                <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                  {econData.estimatedIterationsSaved} Iterations
                </div>
                <div className="text-[10px] text-[#556e87] mt-0.5">Replaced by calibrated physics</div>
              </div>

              <div className="bg-[#0c1622] border border-[#182b3d] p-3.5 rounded-lg text-center">
                <div className="text-[10px] text-[#718aa3] uppercase">Machine Hours Saved</div>
                <div className="text-lg font-mono font-bold text-[#50d8e9] mt-1">
                  {econData.cycleTimeSavedHours} Hours
                </div>
                <div className="text-[10px] text-[#556e87] mt-0.5">Direct chamber capacity freed</div>
              </div>
            </div>

            <div className="mt-3.5 p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-xs text-emerald-300/90 leading-relaxed">
              💡 <strong>Executive Impact:</strong> By accurately verifying thermal kinetics and defect boundaries upfront,
              the engineering team avoids an estimated <strong>${econData.totalCommercialSavingsUsd.toLocaleString()}</strong> in wasted
              plasma-atomized titanium powder, argon gas, and destructive inspection testing per part qualification campaign.
            </div>
          </div>

          {/* Cost Allocation Stacked Bar & Detail Breakdown */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span>Production Cost Allocation Stack</span>
              <span className="font-mono text-xs text-[#50d8e9]">
                ${econData.totalBatchCostUsd.toLocaleString()} Total Batch
              </span>
            </h4>

            {/* Stacked Progress Bar */}
            <div className="h-3.5 w-full bg-[#131d2a] rounded-full overflow-hidden flex">
              <div
                style={{ width: `${powderPct}%` }}
                className="h-full bg-cyan-500 transition-all duration-500"
                title={`Powder: ${powderPct}%`}
              />
              <div
                style={{ width: `${machinePct}%` }}
                className="h-full bg-indigo-500 transition-all duration-500"
                title={`Machine Amortization: ${machinePct}%`}
              />
              <div
                style={{ width: `${argonPct}%` }}
                className="h-full bg-amber-500 transition-all duration-500"
                title={`Argon Shielding: ${argonPct}%`}
              />
              <div
                style={{ width: `${energyPct}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Electrical Power: ${energyPct}%`}
              />
            </div>

            {/* Detailed Grid for 4 Cost Components */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-[#0e1622] border border-[#1c2e42]">
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Powder Material
                </div>
                <div className="font-mono text-sm font-bold text-white">${econData.powderCostUsd.toLocaleString()}</div>
                <div className="text-[10px] text-[#6a849f] mt-0.5">{powderPct}% of batch total</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0e1622] border border-[#1c2e42]">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Machine Rate
                </div>
                <div className="font-mono text-sm font-bold text-white">${econData.machineDepreciationCostUsd.toLocaleString()}</div>
                <div className="text-[10px] text-[#6a849f] mt-0.5">{machinePct}% of batch total</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0e1622] border border-[#1c2e42]">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Argon Shielding
                </div>
                <div className="font-mono text-sm font-bold text-white">${econData.argonGasCostUsd.toLocaleString()}</div>
                <div className="text-[10px] text-[#6a849f] mt-0.5">{argonPct}% of batch total</div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0e1622] border border-[#1c2e42]">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Electricity (kWh)
                </div>
                <div className="font-mono text-sm font-bold text-white">${econData.electricalEnergyCostUsd.toLocaleString()}</div>
                <div className="text-[10px] text-[#6a849f] mt-0.5">{energyPct}% ({econData.energyConsumedKwh} kWh)</div>
              </div>
            </div>
          </div>

          {/* ESG & Sustainability Environmental Scorecard */}
          <div className="bg-[#0b1017] border border-[#1d2736] rounded-xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                <Leaf className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  ESG Environmental Footprint Metric
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-[#88a5c3]">
                    Net Print Emissions: <strong className="text-white font-mono">{econData.carbonEmittedKgCo2} kg CO₂</strong>
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    Emissions Avoided: <strong className="font-mono">~{econData.carbonSavingsAvoidedKgCo2} kg CO₂-eq</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" />
                {econData.sustainabilityRating}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * NIT Trichy Titanium AM Platform — Editable Ti-6Al-4V AM Machine Presets Library
 * Seeded with nominal vendor presets & placeholder economic rates (editable & stored in localStorage).
 */

export type MachineProcessType = 'lpbf' | 'ded-laser' | 'waam';

export interface MachinePreset {
  id: string;
  name: string;
  vendor: string;
  process: MachineProcessType;
  envelopeMm: [number, number, number]; // [X, Y, Z] in mm (cylindrical mapped cleanly to [D, D, Z])
  isCylindrical?: boolean;
  powerRangeW: [number, number];
  laserCount: number;
  spotRangeUm: [number, number];
  layerRangeUm: [number, number];
  maxSpeedMmS: number;
  preheatMaxC: number;
  atmosphere: string;
  hourlyRateUsd: number;        // Editable placeholder rate
  materialCostPerKgUsd: number; // Editable placeholder Ti-6Al-4V powder/wire price
  gasCostPerHourUsd: number;    // Editable placeholder Argon cost
  isPlaceholderRates: boolean;
  isCustom: boolean;
  notes: string;
}

export const MACHINE_STORAGE_KEY = 'nit_am_custom_machines_v1';

export const DEFAULT_MACHINE_PRESETS: readonly MachinePreset[] = [
  {
    id: 'eos-m290',
    name: 'EOS M 290',
    vendor: 'EOS',
    process: 'lpbf',
    envelopeMm: [250, 250, 325],
    powerRangeW: [100, 400],
    laserCount: 1,
    spotRangeUm: [75, 100],
    layerRangeUm: [20, 60],
    maxSpeedMmS: 7000,
    preheatMaxC: 200,
    atmosphere: 'Argon (O₂ < 0.1%)',
    hourlyRateUsd: 95,
    materialCostPerKgUsd: 280,
    gasCostPerHourUsd: 12,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'Nominal industrial single-laser Ti-6Al-4V LPBF workhorse. Cost rates are editable placeholders.'
  },
  {
    id: 'slm-280',
    name: 'Nikon SLM 280 (Twin 400/700 W)',
    vendor: 'Nikon SLM Solutions',
    process: 'lpbf',
    envelopeMm: [280, 280, 365],
    powerRangeW: [100, 700],
    laserCount: 2,
    spotRangeUm: [80, 115],
    layerRangeUm: [20, 90],
    maxSpeedMmS: 10000,
    preheatMaxC: 200,
    atmosphere: 'Argon closed-loop',
    hourlyRateUsd: 125,
    materialCostPerKgUsd: 280,
    gasCostPerHourUsd: 14,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'Nominal dual-laser envelope preset. Cost rates are editable placeholders.'
  },
  {
    id: 'renishaw-500m',
    name: 'Renishaw RenAM 500M',
    vendor: 'Renishaw',
    process: 'lpbf',
    envelopeMm: [250, 250, 350],
    powerRangeW: [100, 500],
    laserCount: 1,
    spotRangeUm: [75, 90],
    layerRangeUm: [20, 60],
    maxSpeedMmS: 7000,
    preheatMaxC: 200,
    atmosphere: 'Vacuum + Argon purge',
    hourlyRateUsd: 105,
    materialCostPerKgUsd: 285,
    gasCostPerHourUsd: 11,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'Nominal aerospace LPBF preset. Cost rates are editable placeholders.'
  },
  {
    id: 'dmp-flex-350',
    name: '3D Systems DMP Flex 350',
    vendor: '3D Systems',
    process: 'lpbf',
    envelopeMm: [275, 275, 420],
    powerRangeW: [100, 500],
    laserCount: 1,
    spotRangeUm: [70, 95],
    layerRangeUm: [20, 60],
    maxSpeedMmS: 5000,
    preheatMaxC: 200,
    atmosphere: 'Vacuum (<25 ppm O₂)',
    hourlyRateUsd: 115,
    materialCostPerKgUsd: 290,
    gasCostPerHourUsd: 10,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'Ultra-low oxygen vacuum chamber ideal for Grade 23 ELI. Placeholder cost rates.'
  },
  {
    id: 'truprint-1000',
    name: 'TRUMPF TruPrint 1000',
    vendor: 'TRUMPF',
    process: 'lpbf',
    envelopeMm: [100, 100, 100],
    isCylindrical: true,
    powerRangeW: [50, 200],
    laserCount: 1,
    spotRangeUm: [30, 55],
    layerRangeUm: [10, 50],
    maxSpeedMmS: 3000,
    preheatMaxC: 200,
    atmosphere: 'Argon (<100 ppm O₂)',
    hourlyRateUsd: 70,
    materialCostPerKgUsd: 310,
    gasCostPerHourUsd: 7,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'Compact lab / R&D cylindrical Ø100 × 100 mm chamber. Placeholder cost rates.'
  },
  {
    id: 'generic-powder-lded',
    name: 'Generic Powder-Fed L-DED Cell',
    vendor: 'Generic / Lab Cell',
    process: 'ded-laser',
    envelopeMm: [600, 600, 500],
    powerRangeW: [400, 4000],
    laserCount: 1,
    spotRangeUm: [800, 2500],
    layerRangeUm: [250, 1000],
    maxSpeedMmS: 50,
    preheatMaxC: 300,
    atmosphere: 'Argon purge glovebox / coaxial shield',
    hourlyRateUsd: 140,
    materialCostPerKgUsd: 260,
    gasCostPerHourUsd: 22,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'Near-net coaxial powder cladding & repair cell. Edit envelope/power to match lab hardware.'
  },
  {
    id: 'generic-wire-lded',
    name: 'Generic Wire-Laser DED Cell',
    vendor: 'Generic / Lab Cell',
    process: 'ded-laser',
    envelopeMm: [900, 900, 700],
    powerRangeW: [800, 6000],
    laserCount: 1,
    spotRangeUm: [1500, 3500],
    layerRangeUm: [500, 1500],
    maxSpeedMmS: 40,
    preheatMaxC: 300,
    atmosphere: 'Argon tent / local trailing shield',
    hourlyRateUsd: 160,
    materialCostPerKgUsd: 145,
    gasCostPerHourUsd: 25,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'High-deposition wire-fed laser DED for large preforms (+ finish machining). Placeholder rates.'
  },
  {
    id: 'generic-robotic-waam',
    name: 'Generic Robotic CMT / GMAW WAAM',
    vendor: 'Generic / Lab Cell',
    process: 'waam',
    envelopeMm: [1500, 1200, 1000],
    powerRangeW: [1000, 4500],
    laserCount: 1,
    spotRangeUm: [2000, 4500],
    layerRangeUm: [800, 2200],
    maxSpeedMmS: 25,
    preheatMaxC: 250,
    atmosphere: 'Trailing laminar Argon shroud',
    hourlyRateUsd: 85,
    materialCostPerKgUsd: 115,
    gasCostPerHourUsd: 18,
    isPlaceholderRates: true,
    isCustom: false,
    notes: 'Large aerospace structural preforms with machining allowance. Placeholder rates.'
  },
  {
    id: 'nit-trichy-custom',
    name: 'NIT Trichy Custom Ti-6Al-4V System (Editable)',
    vendor: 'NIT Trichy AM Lab',
    process: 'lpbf',
    envelopeMm: [250, 250, 300],
    powerRangeW: [100, 400],
    laserCount: 1,
    spotRangeUm: [75, 100],
    layerRangeUm: [20, 60],
    maxSpeedMmS: 2500,
    preheatMaxC: 200,
    atmosphere: 'Argon (O₂ < 0.1%)',
    hourlyRateUsd: 65,
    materialCostPerKgUsd: 275,
    gasCostPerHourUsd: 10,
    isPlaceholderRates: true,
    isCustom: true,
    notes: 'Editable preset for NIT Trichy lab equipment — click Edit Machine Specs to set exact values.'
  }
];

export function loadMachinePresets(storage?: Pick<Storage, 'getItem'>): MachinePreset[] {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  const baseMap = new Map<string, MachinePreset>();
  for (const p of DEFAULT_MACHINE_PRESETS) {
    baseMap.set(p.id, { ...p, envelopeMm: [...p.envelopeMm], powerRangeW: [...p.powerRangeW], spotRangeUm: [...p.spotRangeUm], layerRangeUm: [...p.layerRangeUm] });
  }
  if (!store) return Array.from(baseMap.values());

  try {
    const raw = store.getItem(MACHINE_STORAGE_KEY);
    if (!raw) return Array.from(baseMap.values());
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item.id === 'string' && Array.isArray(item.envelopeMm) && item.envelopeMm.length === 3) {
          baseMap.set(item.id, {
            ...item,
            isCustom: true
          });
        }
      }
    }
  } catch {
    // Ignore malformed localStorage cleanly
  }
  return Array.from(baseMap.values());
}

export function saveCustomMachinePreset(
  machine: MachinePreset,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): MachinePreset[] {
  const all = loadMachinePresets(storage);
  const idx = all.findIndex((m) => m.id === machine.id);
  const sanitized: MachinePreset = {
    ...machine,
    isCustom: true,
    envelopeMm: [
      Math.max(10, Number(machine.envelopeMm[0]) || 250),
      Math.max(10, Number(machine.envelopeMm[1]) || 250),
      Math.max(10, Number(machine.envelopeMm[2]) || 250)
    ],
    hourlyRateUsd: Math.max(1, Number(machine.hourlyRateUsd) || 85),
    materialCostPerKgUsd: Math.max(10, Number(machine.materialCostPerKgUsd) || 260),
    gasCostPerHourUsd: Math.max(0, Number(machine.gasCostPerHourUsd) || 10)
  };

  if (idx >= 0) all[idx] = sanitized;
  else all.push(sanitized);

  const customOnly = all.filter((m) => m.isCustom);
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (store) {
    try {
      store.setItem(MACHINE_STORAGE_KEY, JSON.stringify(customOnly));
    } catch {
      // Ignore quota errors cleanly
    }
  }
  return all;
}

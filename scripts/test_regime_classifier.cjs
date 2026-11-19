/**
 * Automated Verification Suite for Process-Specific Regime Classification,
 * Rosenthal Aspect Callout Synchronization, Dynamic Heat-Source Labels,
 * Preset Deselection, and Single-Source Literature Count (N=178).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Process Regime Classification & Rosenthal Sync Verification Suite...\n');

const htmlPath = path.join(__dirname, '..', 'process_windows_dashboard.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extract inline scripts to evaluate the helpers in a controlled sandbox
const scriptBlocks = [];
const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptRegex.exec(html)) !== null) {
  scriptBlocks.push(match[1]);
}

// Create minimal DOM mock
const elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      value: '',
      min: '0',
      max: '10000',
      step: '1',
      innerText: '',
      textContent: '',
      innerHTML: '',
      title: '',
      className: '',
      style: {},
      dataset: {},
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, cond) {
          if (cond === undefined) {
            if (this._set.has(c)) this._set.delete(c); else this._set.add(c);
          } else if (cond) {
            this._set.add(c);
          } else {
            this._set.delete(c);
          }
        },
        contains(c) { return this._set.has(c); }
      },
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k] || ''; }
    };
  }
  return elements[id];
}

// Seed default slider values
getEl('sl_p').value = '280'; getEl('sl_p').min = '80'; getEl('sl_p').max = '450'; getEl('sl_p').step = '5';
getEl('sl_v').value = '960'; getEl('sl_v').min = '300'; getEl('sl_v').max = '2200'; getEl('sl_v').step = '10';
getEl('sl_h').value = '110'; getEl('sl_h').min = '50'; getEl('sl_h').max = '180'; getEl('sl_h').step = '5';
getEl('sl_t').value = '40';  getEl('sl_t').min = '20'; getEl('sl_t').max = '90';  getEl('sl_t').step = '5';
getEl('sl_spot').value = '80'; getEl('sl_spot').min = '40'; getEl('sl_spot').max = '160'; getEl('sl_spot').step = '5';
getEl('sl_preheat').value = '200'; getEl('sl_preheat').min = '25'; getEl('sl_preheat').max = '650'; getEl('sl_preheat').step = '5';
getEl('targetVedSlider').value = '66.3'; getEl('targetVedSlider').min = '20'; getEl('targetVedSlider').max = '140';
getEl('postProcessingSelect').value = 'HIP';
getEl('alloySelect').value = 'ti64_gr5';

global.window = global;
global.document = {
  body: { classList: getEl('body').classList, appendChild() {}, removeChild() {} },
  documentElement: { classList: getEl('html').classList },
  getElementById: (id) => getEl(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => getEl('tmp_' + tag),
  execCommand: () => true
};
global.window.addEventListener = () => {};
global.window.location = {
  protocol: 'http:',
  pathname: '/',
  search: '',
  hash: '',
  href: 'http://localhost:3000/'
};
global.window.history = { replaceState() {} };

// Evaluate script block 0 (contains classifyProcessRegime, formatRosenthalAspectCallout, etc.)
eval(scriptBlocks[0]);

// 1. Test WAAM Regime Classification (HI < 120, 120-600, > 600 J/mm)
const waamLow = global.classifyProcessRegime('waam', { P: 1000, v: 10, h: 3500, t: 1500 }); // HI = 100 J/mm
assert.strictEqual(waamLow.regimeLabel, 'Lack of Fusion / Cold Lap');
assert.strictEqual(waamLow.severity, 'warning');
assert.strictEqual(waamLow.tweakCtaLabel, 'Auto-Tweak to Nominal Heat Input');
console.log('  ✅ PASS: WAAM Low HI (100 J/mm) -> Lack of Fusion / Cold Lap (warning), CTA="Auto-Tweak to Nominal Heat Input"');

const waamOpt = global.classifyProcessRegime('waam', { P: 2400, v: 8, h: 3500, t: 1500 }); // HI = 300 J/mm
assert.strictEqual(waamOpt.regimeLabel, 'Optimal Arc Deposition');
assert.strictEqual(waamOpt.severity, 'optimal');
console.log('  ✅ PASS: WAAM Nominal HI (300 J/mm) -> Optimal Arc Deposition (optimal)');

const waamHigh = global.classifyProcessRegime('waam', { P: 3750, v: 5, h: 3500, t: 1500 }); // HI = 750 J/mm
assert.strictEqual(waamHigh.regimeLabel, 'Overheating / Coarse-β Instability');
assert.strictEqual(waamHigh.severity, 'danger');
assert.strictEqual(waamHigh.solverWindowMessage, 'Excessive arc linear heat input (>600 J/mm) causes remelt sag, heavy residual stress, and coarse prior-β grains.');
assert.strictEqual(waamHigh.remediationHeading, 'Overheating active! Reduce Linear Heat Input below 600 J/mm:');
assert.strictEqual(waamHigh.tweakCtaLabel, 'Auto-Tweak to Nominal Heat Input');
assert(!JSON.stringify(waamHigh).toLowerCase().includes('keyhole'));
assert(!JSON.stringify(waamHigh).includes('110 J/mm³'));
console.log('  ✅ PASS: WAAM High HI (750 J/mm @ 3750W, 5mm/s) -> Overheating / Coarse-β Instability (danger), zero Keyhole or >110 J/mm³');

// 2. Test LPBF & L-DED Regime Classification
const lpbfKh = global.classifyProcessRegime('lpbf', { P: 420, v: 500, h: 110, t: 40 }); // VED = 190.9 J/mm³
assert.strictEqual(lpbfKh.code, 'keyhole');
assert.strictEqual(lpbfKh.severity, 'danger');
assert.strictEqual(lpbfKh.remediationHeading, 'Keyhole active! Tweaks to prevent gas pore entrapment:');
assert.strictEqual(lpbfKh.tweakCtaLabel, 'Auto-Tweak to Conduction');
console.log('  ✅ PASS: LPBF High VED (>110 J/mm³) retains Keyhole active warning and Auto-Tweak to Conduction');

// 3. Test Binder Jetting Regime Classification
const bjOpt = global.classifyProcessRegime('binder_jetting', { P: 120, v: 400, h: 50, t: 50, T0: 180 });
assert.strictEqual(bjOpt.code, 'sintering');
assert.strictEqual(bjOpt.severity, 'optimal');
console.log('  ✅ PASS: Binder Jetting classified strictly by sintering & binder saturation bounds');

// 4. Test Rosenthal Aspect Callout Synchronization
const calloutOpt = global.formatRosenthalAspectCallout(0.51, waamOpt, 'rosenthal');
assert.strictEqual(calloutOpt.fullText, '0.51 — Conduction / Stable Pool');
assert.strictEqual(calloutOpt.color, '#10b981');

const calloutDanger = global.formatRosenthalAspectCallout(0.55, waamHigh, 'rosenthal');
assert.strictEqual(calloutDanger.fullText, '0.55 — Point-Source Bound (Overheating / Coarse-β Instability)');
assert.strictEqual(calloutDanger.color, '#f43f5e');
assert(calloutDanger.tooltip.includes('Classic Rosenthal (1946) assumes conduction-mode'));
console.log('  ✅ PASS: Rosenthal Aspect Callout syncs with regime ("0.55 — Point-Source Bound (Overheating / Coarse-β Instability)")');

// 5. Test Dynamic Heat-Source X-Axis Label
assert.strictEqual(global.getHeatSourceLongitudinalLabel('lpbf'), 'Longitudinal Distance from Laser Center x (µm / mm)');
assert.strictEqual(global.getHeatSourceLongitudinalLabel('lded'), 'Longitudinal Distance from Laser Center x (µm / mm)');
assert.strictEqual(global.getHeatSourceLongitudinalLabel('waam'), 'Longitudinal Distance from Arc Center x (µm / mm)');
console.log('  ✅ PASS: Heat-source X-axis label dynamically switches between Laser Center and Arc Center');

// 6. Test Preset Matching & Deselection (±1% tolerance)
assert.strictEqual(global.getActiveMeltPoolPresetId('waam', 2400, 8), 'waam');
assert.strictEqual(global.getActiveMeltPoolPresetId('waam', 2415, 8.05), 'waam'); // within 1%
assert.strictEqual(global.getActiveMeltPoolPresetId('waam', 3750, 5), null); // diverged -> null
assert.strictEqual(global.getActiveMeltPoolPresetId('lpbf', 200, 950), '200w');
assert.strictEqual(global.getActiveMeltPoolPresetId('lpbf', 280, 960), null);
console.log('  ✅ PASS: Preset matching highlights within ±1% tolerance and unhighlights when sliders diverge');

// 7. Test Single-Source Literature Count (LITERATURE_META.totalPublications = 178)
assert.strictEqual(global.LITERATURE_META.totalPublications, 178);
assert.strictEqual(global.LITERATURE_DATASET_META.totalPublications, 178);
console.log('  ✅ PASS: Single-source LITERATURE_META.totalPublications = 178');

console.log('\n🎉 All 7 Regime Classification & Rosenthal Sync test suites passed (100%)!');

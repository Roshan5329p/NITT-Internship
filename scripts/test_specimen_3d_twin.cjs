/**
 * Automated Verification Suite for Solid ASTM E8 3D Specimen Geometry,
 * Coupled Stress Field Solver, Cutaway View, Heatmap Normalization & Toggles.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running 3D Specimen Stress Field & Geometry Verification Suite...\n');

const htmlPath = path.join(__dirname, '..', 'process_windows_dashboard.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scriptBlocks = [];
const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
while ((match = scriptRegex.exec(html)) !== null) {
  scriptBlocks.push(match[1]);
}

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
      getAttribute(k) { return this[k] || ''; },
      addEventListener() {}
    };
  }
  return elements[id];
}

// Provide minimal canvas 2D mock for buildDogboneMesh & renderTwin
getEl('twinCanvas').width = 760;
getEl('twinCanvas').height = 420;
const drawOps = [];
getEl('twinCanvas').getContext = () => ({
  clearRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  closePath() {},
  fill() { drawOps.push({ type: 'fill', fillStyle: this.fillStyle }); },
  stroke() { drawOps.push({ type: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
  arc() {},
  save() {},
  restore() {},
  setLineDash() {},
  roundRect() {},
  rect() {},
  measureText(t) { return { width: t.length * 6 }; },
  fillText() {}
});

getEl('sl_p').value = '280';
getEl('sl_v').value = '960';
getEl('sl_h').value = '110';
getEl('sl_t').value = '40';
getEl('sl_spot').value = '80';
getEl('sl_preheat').value = '200';
getEl('postProcessingSelect').value = 'HIP';
getEl('alloySelect').value = 'ti64_gr5';
getEl('view_digital-twin').classList.add('active');

global.window = global;
global.requestAnimationFrame = () => 1;
global.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  body: { classList: getEl('body').classList, appendChild() {}, removeChild() {} },
  documentElement: { classList: getEl('html').classList },
  getElementById: (id) => getEl(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: (tag) => getEl('tmp_' + tag),
  execCommand: () => true
};
global.window.addEventListener = () => {};
global.window.location = { protocol: 'http:', pathname: '/', search: '', hash: '', href: 'http://localhost:3000/' };
global.window.history = { replaceState() {} };

// Evaluate script block 0 (solvers & helpers) in global scope
(0, eval)(scriptBlocks[0]);
// Evaluate script block 1 (dashboard & 3D twin engine) in global scope
// Stop before init calls at very end or run cleanly since DOM mocks exist
(0, eval)(scriptBlocks[1]);

// 1. Verify Solid ASTM E8 Round Tensile Proportions
assert.strictEqual(global.evaluateAstmE8NormalizedRadius(0.0).toFixed(4), '0.5600');
assert.strictEqual(global.evaluateAstmE8NormalizedRadius(0.46).toFixed(4), '0.5600');
assert.strictEqual(global.evaluateAstmE8NormalizedRadius(0.62).toFixed(4), '1.0000');
assert.strictEqual(global.evaluateAstmE8NormalizedRadius(1.00).toFixed(4), '1.0000');
const midFilletR = global.evaluateAstmE8NormalizedRadius(0.54);
assert(midFilletR > 0.70 && midFilletR < 0.86, 'Fillet midpoint must blend smoothly');
assert(global.dogboneMesh.angularSegments >= 36, 'Radial angular segments must be >= 36');
assert(global.dogboneMesh.radialSegments >= 4, 'Interior end-cap / cutaway radial rings >= 4');
const gaugeLenToDia = (0.92 * global.dogboneMesh.Z_HALF) / (2 * 0.56 * global.dogboneMesh.R_GRIP);
assert(gaugeLenToDia >= 3.8 && gaugeLenToDia <= 4.2, `Gauge L/D ratio ~4:1, got ${gaugeLenToDia}`);
console.log(`  ✅ PASS: ASTM E8 revolve profile exact (R_gauge=0.56, R_grip=1.00, fillets 0.46..0.62, L/D=${gaugeLenToDia.toFixed(2)}:1, ${global.dogboneMesh.angularSegments} radial segments)`);

// 2. Verify LPBF Stress Field & Preheat T0 Scaling (As-Built vs Post-Processing)
const lpbfAsBuilt25 = global.computeSpecimenStressField('lpbf', 'ti64_gr5', { P: 280, v: 960, h: 110, t: 40, T0: 25 }, 'None');
const lpbfAsBuilt300 = global.computeSpecimenStressField('lpbf', 'ti64_gr5', { P: 280, v: 960, h: 110, t: 40, T0: 300 }, 'None');
const lpbfStressRel = global.computeSpecimenStressField('lpbf', 'ti64_gr5', { P: 280, v: 960, h: 110, t: 40, T0: 200 }, 'Stress-relieved');
const lpbfAnnealed = global.computeSpecimenStressField('lpbf', 'ti64_gr5', { P: 280, v: 960, h: 110, t: 40, T0: 200 }, 'Annealed');
const lpbfHip = global.computeSpecimenStressField('lpbf', 'ti64_gr5', { P: 280, v: 960, h: 110, t: 40, T0: 200 }, 'HIP');
const lpbfSta = global.computeSpecimenStressField('lpbf', 'ti64_gr5', { P: 280, v: 960, h: 110, t: 40, T0: 200 }, 'Solution-Aged');

assert(lpbfAsBuilt25.peakSurfaceStressMpa >= 350 && lpbfAsBuilt25.peakSurfaceStressMpa <= 680);
assert(lpbfAsBuilt25.coreCompressiveStressMpa <= -250 && lpbfAsBuilt25.coreCompressiveStressMpa >= -480);
assert(lpbfAsBuilt300.peakSurfaceStressMpa < lpbfAsBuilt25.peakSurfaceStressMpa, 'Preheat 300C must reduce stress vs 25C');
assert.strictEqual(lpbfStressRel.postFactor, 0.28);
assert.strictEqual(lpbfAnnealed.postFactor, 0.18);
assert.strictEqual(lpbfHip.postFactor, 0.08);
assert.strictEqual(lpbfSta.postFactor, 0.22);
console.log(`  ✅ PASS: LPBF As-Built (T0=25°C -> +${lpbfAsBuilt25.peakSurfaceStressMpa}/${lpbfAsBuilt25.coreCompressiveStressMpa} MPa; T0=300°C -> +${lpbfAsBuilt300.peakSurfaceStressMpa} MPa; HIP -> +${lpbfHip.peakSurfaceStressMpa} MPa)`);

// 3. Verify Spatial Stress Profile sigma(r, z): parabolic radial + 1.12x fillet shoulder concentration
const coreVal = global.evaluateLocalResidualStressMpa(0.0, 0.0, lpbfAsBuilt25);
const neutralVal = global.evaluateLocalResidualStressMpa(0.70, 0.0, lpbfAsBuilt25);
const gaugeSurfVal = global.evaluateLocalResidualStressMpa(1.0, 0.0, lpbfAsBuilt25);
const filletSurfVal = global.evaluateLocalResidualStressMpa(1.0, 0.48, lpbfAsBuilt25);
assert.strictEqual(Math.round(coreVal), lpbfAsBuilt25.coreCompressiveStressMpa);
assert(Math.abs(neutralVal) < 1e-6, 'Zero-stress neutral zone at r = 0.70R');
assert(filletSurfVal > gaugeSurfVal * 1.10, 'Fillet shoulder exhibits +12% stress concentration');
console.log(`  ✅ PASS: Spatial stress σ(r,z) verified (core=${Math.round(coreVal)} MPa, r=0.70R=${neutralVal.toFixed(2)} MPa, gauge=+${Math.round(gaugeSurfVal)} MPa, fillet=+${Math.round(filletSurfVal)} MPa)`);

// 4. Verify WAAM Overheating Distortion & Binder Jetting Sinter Mode
const waamOverheat = global.computeSpecimenStressField('waam', 'ti64_gr5', { P: 3750, v: 5, h: 3500, t: 1500, T0: 120 }, 'None');
assert.strictEqual(waamOverheat.thermalDistortionActive, true);
assert(waamOverheat.warpageSeverity > 0.2);
const bjtField = global.computeSpecimenStressField('binder-jetting', 'ti64_gr5', { P: 120, v: 400, h: 50, t: 50, T0: 180 }, 'HIP');
assert.strictEqual(bjtField.isBinderJetting, true);
assert(bjtField.peakSurfaceStressMpa <= 25 && bjtField.coreCompressiveStressMpa >= -25);
console.log(`  ✅ PASS: WAAM Overheat triggers warpage highlight (peak=+${waamOverheat.peakSurfaceStressMpa} MPa); Binder Jetting sintered mode (+${bjtField.peakSurfaceStressMpa}/${bjtField.coreCompressiveStressMpa} MPa)`);

// 5. Verify Heatmap Mapping Difference (As-Built Red/Blue vs HIP Green/Cyan)
const uSurfAsBuilt = getHeatmapNormalizedU(1.0, 0.48, 0, lpbfAsBuilt25, 88.5);
const uCoreAsBuilt = getHeatmapNormalizedU(0.0, 0.0, 0, lpbfAsBuilt25, 88.5);
const uSurfHip = getHeatmapNormalizedU(1.0, 0.48, 0, lpbfHip, 0.0);
assert(uSurfAsBuilt > 0.85, `As-Built surface must map to orange/red (u=${uSurfAsBuilt})`);
assert(uCoreAsBuilt < 0.15, `As-Built core must map to blue (u=${uCoreAsBuilt})`);
assert(uSurfHip >= 0.38 && uSurfHip <= 0.50, `HIP surface must relax to cool cyan/green (u=${uSurfHip})`);
console.log(`  ✅ PASS: Heatmap u separation verified (As-Built core=${uCoreAsBuilt.toFixed(2)} blue, surf=${uSurfAsBuilt.toFixed(2)} red; HIP surf=${uSurfHip.toFixed(2)} cool green/cyan)`);

// 6. Verify Wireframe OFF has zero dark strokes & Cutaway ON activates cut-wall quads
drawOps.length = 0;
global.renderTwin();
const hasDarkStroke = drawOps.some(op => op.type === 'stroke' && String(op.strokeStyle).includes('15, 23, 42'));
assert.strictEqual(hasDarkStroke, false, 'Wireframe OFF must never draw dark grid lines');
const solidFillCount = drawOps.filter(op => op.type === 'fill').length;
assert(solidFillCount > 100, 'Solid specimen with capped ends renders > 100 front-facing filled quads');

global.toggleCutaway();
assert.strictEqual(global.twinCutaway, true);
drawOps.length = 0;
global.renderTwin();
const cutawayFillCount = drawOps.filter(op => op.type === 'fill').length;
assert(cutawayFillCount > 50, 'Cutaway ON renders internal cross-section wall quads + shell');
console.log(`  ✅ PASS: Wireframe OFF has zero dark grid lines (${solidFillCount} filled quads); Cutaway ON renders ${cutawayFillCount} solid+cutaway quads`);

console.log('\n🎉 All 6 3D Specimen Stress Field & Geometry test suites passed (100%)!');

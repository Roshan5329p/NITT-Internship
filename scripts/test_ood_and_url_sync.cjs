/**
 * Automated Verification Suite for:
 * 1. Out-of-Distribution (OOD) Extrapolation Detector (evaluateOodRisk)
 * 2. Dynamic 95% PI Widening & Extrapolation Warning Banner
 * 3. Bi-Directional URL Query-String State Sync (parseUrlDashboardState, serializeDashboardStateToQuery)
 * 4. "Share Run" Button & Safe Malformed URL Fallback
 */

const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('process_windows_dashboard.html', 'utf8');
const scripts = [];
for (const m of html.matchAll(/<script(?:\s([^>]*))?>([\s\S]*?)<\/script>/gi)) {
  const attrs = m[1] || '';
  if (/\bsrc\s*=/i.test(attrs) || /application\/ld\+json/i.test(attrs)) continue;
  if (m[2].trim()) scripts.push(m[2]);
}
const script1 = scripts[0];
const dashboardDataCode = fs.existsSync('js/dashboard-data.js') ? fs.readFileSync('js/dashboard-data.js', 'utf8') : '';

const elements = {};
function getEl(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      value: '',
      min: '0',
      max: '5000',
      step: '1',
      innerText: '',
      innerHTML: '',
      style: { display: 'none' },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, b) { if (b) this._set.add(c); else this._set.delete(c); },
        contains(c) { return this._set.has(c); }
      }
    };
  }
  return elements[id];
}

getEl('sl_p').value = '280';
getEl('sl_v').value = '960';
getEl('sl_h').value = '110';
getEl('sl_t').value = '40';
getEl('sl_spot').value = '80';
getEl('sl_preheat').value = '200';
getEl('alloySelect').value = 'ti64_gr5';
getEl('postProcessingSelect').value = 'HIP';
getEl('shareRunBtn').innerText = '🔗 Share Run';

global.window = global;
global.window.location = {
  pathname: '/',
  search: '',
  hash: '',
  href: 'http://localhost:3000/'
};
global.window.history = {
  replaceState(state, title, url) {
    const qIdx = url.indexOf('?');
    global.window.location.search = qIdx >= 0 ? url.slice(qIdx) : '';
    global.window.location.href = 'http://localhost:3000' + url;
  }
};
global.window.addEventListener = () => {};
global.document = {
  getElementById: getEl,
  querySelectorAll: () => [],
  addEventListener: () => {},
  documentElement: { className: 'dark' }
};
const clipboardMock = {
  lastCopied: null,
  writeText(txt) {
    this.lastCopied = txt;
    return Promise.resolve();
  }
};
Object.defineProperty(global.navigator, 'clipboard', { value: clipboardMock, configurable: true });

if (dashboardDataCode) (0, eval)(dashboardDataCode);
(0, eval)(script1);

console.log('🧪 Running OOD Extrapolation & URL State Sync Verification Suite...\n');

// Test 1: Nominal LPBF parameters are in_distribution with piMultiplier = 1.0
const nomOod = window.evaluateOodRisk({ P: 280, v: 960, h: 110, t: 40, T0: 200 }, 'lpbf');
assert.strictEqual(nomOod.status, 'in_distribution', 'Nominal LPBF should be in_distribution');
assert.strictEqual(nomOod.piMultiplier, 1.0, 'Nominal LPBF piMultiplier should be 1.0');
assert.strictEqual(nomOod.violations.length, 0, 'Nominal LPBF should have 0 violations');
console.log(`  ✅ PASS: Nominal LPBF -> status=${nomOod.status}, dM=${nomOod.mahalanobisDistance}, piMultiplier=${nomOod.piMultiplier}`);

// Test 2: Extreme LPBF parameters trigger extrapolating status, violations, and widened piMultiplier
const extOod = window.evaluateOodRisk({ P: 450, v: 2100, h: 110, t: 40, T0: 200 }, 'lpbf');
assert.strictEqual(extOod.status, 'extrapolating', 'Extreme LPBF should be extrapolating');
assert.ok(extOod.mahalanobisDistance > 3.5, 'Extreme LPBF dM should exceed 3.5');
assert.ok(extOod.piMultiplier > 1.0 && extOod.piMultiplier <= 2.2, 'Extreme LPBF piMultiplier should scale in (1.0, 2.2]');
assert.ok(extOod.violations.some(v => v.includes('Laser Power (450 W) exceeds validated LPBF range (100–400 W)')), 'Should report Laser Power violation');
assert.ok(extOod.violations.some(v => v.includes('Scan Speed (2100 mm/s) exceeds validated LPBF range (400–1600 mm/s)')), 'Should report Scan Speed violation');
console.log(`  ✅ PASS: Extreme LPBF -> status=${extOod.status}, dM=${extOod.mahalanobisDistance}, piMultiplier=${extOod.piMultiplier}, violations=${extOod.violations.length}`);

// Test 3: renderUnifiedModelsUI widens 95% PI in sync across Top KPI card and Model Table, shows (Extrapolated) and Banner
window.setActiveModel('ensemble');
window.renderUnifiedModelsUI({ analytical: 336, rf: 343, xgboost: 341, svm: 341, gpr: 339, ensemble: 340 }, 'hip', extOod);
const expectedEnsemblePi = Number((10.2 * extOod.piMultiplier).toFixed(1));
const kpiCiText = getEl('kpi_ci').innerText;
const tableHtml = getEl('modelsTableBody').innerHTML;
assert.ok(kpiCiText.includes(`± ${expectedEnsemblePi} HV`), `Top KPI card should show ± ${expectedEnsemblePi} HV, got: ${kpiCiText}`);
assert.ok(kpiCiText.includes('(Extrapolated)'), 'Top KPI card should append (Extrapolated) tag');
assert.ok(tableHtml.includes(`± ${expectedEnsemblePi} HV`), 'Model table should show widened ensemble 95% PI');
assert.strictEqual(getEl('oodExtrapolationBanner').style.display, 'block', 'Extrapolation banner should be visible');
console.log(`  ✅ PASS: Dynamic 95% PI widening synced across KPI card ("${kpiCiText}") & table, banner visible`);

// Test 4: Reset back to nominal hides banner and restores base 95% PI
window.renderUnifiedModelsUI({ analytical: 336, rf: 343, xgboost: 341, svm: 341, gpr: 339, ensemble: 340 }, 'hip', nomOod);
assert.strictEqual(getEl('oodExtrapolationBanner').style.display, 'none', 'Extrapolation banner should be hidden when in_distribution');
assert.ok(getEl('kpi_ci').innerText.includes('± 10.2 HV'), 'Base 95% PI restored to ± 10.2 HV');
assert.ok(!getEl('kpi_ci').innerText.includes('(Extrapolated)'), '(Extrapolated) tag removed when in_distribution');
console.log('  ✅ PASS: Returning to nominal envelope hides banner and restores base 95% PI (± 10.2 HV)');

// Test 5: Bi-Directional URL Query-String Serialization & Parsing
const validSearch = '?proc=lpbf&alloy=ti64_eli&P=315&v=960&h=110&t=40&db=80&T0=200&post=Annealed&model=gpr';
const parsedValid = window.parseUrlDashboardState(validSearch);
assert.strictEqual(parsedValid.proc, 'lpbf');
assert.strictEqual(parsedValid.alloy, 'ti64_eli');
assert.strictEqual(parsedValid.P, 315);
assert.strictEqual(parsedValid.post, 'Annealed');
assert.strictEqual(parsedValid.model, 'gpr');
const serialized = window.serializeDashboardStateToQuery(parsedValid);
assert.strictEqual(serialized, validSearch, 'Serialized query should match expected compact URL format');
console.log(`  ✅ PASS: URL State Serialization & Hydration -> "${serialized}"`);

// Test 6: Malformed URL Query Fallback & Clamping (/?P=invalid&v=-500&proc=unknown)
const malformedSearch = '?P=invalid&v=-500&proc=unknown&alloy=bad&post=invalid&model=nonexistent';
const parsedMalformed = window.parseUrlDashboardState(malformedSearch);
assert.strictEqual(parsedMalformed.proc, 'lpbf', 'Invalid proc should fall back to lpbf');
assert.strictEqual(parsedMalformed.alloy, 'ti64_gr5', 'Invalid alloy should fall back to ti64_gr5');
assert.strictEqual(parsedMalformed.P, 280, 'Non-numeric P=invalid should fall back to nominal 280 W without NaN');
assert.strictEqual(parsedMalformed.v, 300, 'Out-of-bounds v=-500 should clamp to LPBF min 300 mm/s');
assert.strictEqual(parsedMalformed.post, 'HIP', 'Invalid post should fall back to HIP');
assert.strictEqual(parsedMalformed.model, 'ensemble', 'Invalid model should fall back to ensemble');
console.log(`  ✅ PASS: Malformed URL Fallback & Clamping -> proc=${parsedMalformed.proc}, P=${parsedMalformed.P}, v=${parsedMalformed.v}, post=${parsedMalformed.post}, model=${parsedMalformed.model}`);

// Test 7: Share Run Button flushes URL and copies to clipboard
window.hydrateDashboardFromUrl();
window.shareCurrentRun();
assert.ok(global.navigator.clipboard.lastCopied.includes('?proc=lpbf&alloy=ti64_gr5&P=280&v=960&h=110&t=40&db=80&T0=200&post=HIP&model=ensemble'));
console.log(`  ✅ PASS: Share Run button flushed state & copied URL -> ${global.navigator.clipboard.lastCopied}`);

console.log('\n🎉 All 7 OOD & URL Synchronization test suites passed (100%)!');
process.exit(0);

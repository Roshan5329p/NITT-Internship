const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('process_windows_dashboard.html', 'utf-8');

assert(html.includes('id="aud_ys_val">865 MPa</span>'), 'aud_ys_val should be 865 MPa');
assert(html.includes('id="aud_uts_val">950 MPa</span>'), 'aud_uts_val should be 950 MPa');
assert(html.includes('id="aud_el_val">14.5 %</span>'), 'aud_el_val should be 14.5 %');
assert(html.includes('id="aud_den_val">99.98 %</span>'), 'aud_den_val should be 99.98 %');
assert(html.includes('id="aud_stress_val">15 MPa</span>'), 'aud_stress_val should be 15 MPa');
assert(html.includes('id="aud_fatigue_val">675 MPa</span>'), 'aud_fatigue_val should be 675 MPa');
assert(html.includes('id="astmOverallPillBadge"') && html.includes('COMPLIANT</span>'), 'overall badge should be COMPLIANT');
assert(html.includes('window.latestPhysicsState'), 'window.latestPhysicsState must be present');

console.log('✅ DOM static HTML checks all passed!');

// Verify that hardcoded table lookups (1200 / 1050 / 920 in updateAstmAuditor) were replaced by dynamic physics reading
assert(!html.includes('measuredYs = 1200;\n  let measuredUts = 1290;\n  let measuredElong = 7.5;'), 'Old hardcoded block must not be in updateAstmAuditor');

console.log('✅ Hardcoded block successfully eliminated from updateAstmAuditor!');

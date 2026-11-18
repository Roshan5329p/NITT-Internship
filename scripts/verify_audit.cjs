const fs = require('fs');
const html = fs.readFileSync('process_windows_dashboard.html', 'utf8');

console.log('--- RE-CHECKING AUDIT POINTS ---');

// 1. Check table SVM vs bar SVM
const tableSvmMatch = html.match(/<strong>Support Vector Machine \(RBF-SVR\)<\/strong><\/td>\s*<td[^>]*>(\d+)\s*HV/);
const barSvmMatch = html.match(/<div class="bar-pill" id="bar_3"[^>]*>(\d+)<\/div>/);
console.log('Static Table SVM:', tableSvmMatch ? tableSvmMatch[1] : 'null');
console.log('Static Bar SVM:  ', barSvmMatch ? barSvmMatch[1] : 'null');

// 2. Check table Ensemble vs bar Ensemble
const tableEnsMatch = html.match(/<strong>Multi-Model Consensus Ensemble<\/strong>[\s\S]*?<td[^>]*>(\d+)\s*HV/);
const barEnsMatch = html.match(/<div class="bar-pill" id="bar_5"[^>]*>(\d+)<\/div>/);
console.log('Static Table Ensemble:', tableEnsMatch ? tableEnsMatch[1] : 'null');
console.log('Static Bar Ensemble:  ', barEnsMatch ? barEnsMatch[1] : 'null');

// 3. Top KPI card
const kpiHv = html.match(/<div class="kpi-value" id="kpi_hv">(\d+)\s*HV/);
const kpiCi = html.match(/<div class="kpi-sub" id="kpi_ci">([^<]+)<\/div>/);
console.log('Top KPI Hardness:', kpiHv ? kpiHv[1] : 'null');
console.log('Top KPI CI:      ', kpiCi ? kpiCi[1].trim() : 'null');

// 4. Literature banner vs model card sub
const litBanner = html.match(/id="matrixPapersCountBadge">([^<]+)<\/span>/);
const modelSub = html.match(/class="model-card-sub">([^<]+)<\/div>/);
console.log('Lit Banner: ', litBanner ? litBanner[1].trim() : 'null');
console.log('Model Sub:  ', modelSub ? modelSub[1].trim() : 'null');

// 5. VED Solver defaults
const targetVed = html.match(/id="targetVedDisplay">([^<]+)<\/div>|id="targetVedDisplay">([^<]+)<\/span>/);
const derivedVed = html.match(/id="derivedVedLabel">([^<]+)<\/span>/);
const solP = html.match(/id="sol_p">([^<]+)<\/strong>/);
const solV = html.match(/id="sol_v">([^<]+)<\/strong>/);
const solRate = html.match(/id="sol_rate">([^<]+)<\/strong>/);
console.log('Solver Target VED: ', targetVed ? (targetVed[1] || targetVed[2]).trim() : 'null');
console.log('Solver Derived VED:', derivedVed ? derivedVed[1].trim() : 'null');
console.log('Solver Solved P:   ', solP ? solP[1].trim() : 'null');
console.log('Solver Solved v:   ', solV ? solV[1].trim() : 'null');
console.log('Solver Build Rate: ', solRate ? solRate[1].trim() : 'null');

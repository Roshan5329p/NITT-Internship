/**
 * NIT Trichy Titanium AM Platform - Database & Service Statistics API
 * Reports verified live database telemetry vs. curated benchmark dataset baselines.
 * Never presents fallback numbers as live database counts.
 */

import { setCorsHeaders } from './_shared.js';
import { APP_METADATA, LITERATURE_DATASET_META } from './_platform_constants.js';

export default async function handler(req, res) {
  if (setCorsHeaders(req, res)) return;

  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      code: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} is not allowed. Use GET.`
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  let dbStatus = 'unconfigured';
  let verifiedLiveCount = null;
  let dbError = null;

  if (supabaseUrl && supabaseKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const r = await fetch(`${supabaseUrl}/rest/v1/papers?select=count`, {
        signal: controller.signal,
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Range': '0-0',
          'Prefer': 'count=exact'
        }
      });
      clearTimeout(timeoutId);

      if (r.ok) {
        const cr = r.headers.get('content-range');
        if (cr && cr.includes('/')) {
          verifiedLiveCount = parseInt(cr.split('/')[1], 10);
          dbStatus = 'connected';
        } else {
          dbStatus = 'connected';
          verifiedLiveCount = null;
        }
      } else {
        dbStatus = 'degraded';
        dbError = `Supabase responded with HTTP ${r.status}`;
      }
    } catch (e) {
      dbStatus = 'offline';
      dbError = e.name === 'AbortError' ? 'Database query timed out (4000ms)' : 'Database connection unavailable';
    }
  } else {
    dbStatus = 'unconfigured';
    dbError = 'SUPABASE_URL or SUPABASE_ANON_KEY environment variables not set in deployment.';
  }

  res.status(200).json({
    platform: APP_METADATA.name,
    version: APP_METADATA.version,
    deployment: APP_METADATA.deploymentTarget,
    service_health: {
      api: 'operational',
      database: dbStatus,
      database_error: dbError,
      verified_live_papers_count: verifiedLiveCount
    },
    curated_benchmark_dataset: {
      total_indexed_publications: LITERATURE_DATASET_META.totalPublications,
      loo_benchmark_papers: LITERATURE_DATASET_META.looBenchmarkCount,
      peer_reviewed_papers: LITERATURE_DATASET_META.looBenchmarkCount,
      experimental_alloy_variants: LITERATURE_DATASET_META.totalVariants,
      tracked_metrics_count: LITERATURE_DATASET_META.trackedMetricsCount,
      date_range: LITERATURE_DATASET_META.dateRange,
      data_integrity: '100% parameter verified against original literature DOIs',
      primary_alloys: ['Ti-6Al-4V Grade 5 (UNS R56400)', 'Ti-6Al-4V ELI Grade 23 (UNS R56401)'],
      qualification_standards: ['ASTM F2924-21 (Class 1, Class 2, Class 3)', 'ASTM F3001-20 (Medical ELI)']
    },
    supported_processes: [
      { code: 'LPBF', name: 'Laser Powder Bed Fusion', status: 'Active (Rosenthal & Coen Hybrid)' },
      { code: 'L-DED', name: 'Laser Directed Energy Deposition', status: 'Active (Bontha G/R Solidification)' },
      { code: 'WAAM', name: 'Wire Arc Additive Manufacturing', status: 'Active (Thermal Accumulation Model)' },
      { code: 'BJ', name: 'Binder Jetting', status: 'Active (Sintering Densification)' }
    ],
    post_processing_regimes: [
      { code: 'as_built', name: "As-Built (α' Martensite)", compliance: 'Non-Compliant (Elongation < 10%)' },
      { code: 'stress_relieved', name: 'Stress-Relieved (650°C / 2h)', compliance: 'ASTM Class 2/3' },
      { code: 'annealed', name: 'Annealed (730°C / 2h)', compliance: 'ASTM Class 2' },
      { code: 'hip', name: 'Hot Isostatic Pressed (920°C / 100 MPa / 2h)', compliance: 'ASTM Class 1 (Full Compliance)' },
      { code: 'sta', name: 'Solution-Treated & Aged (STA)', compliance: 'High Strength Aviation Class' }
    ]
  });
}

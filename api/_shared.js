/**
 * Shared Utilities for NIT Trichy Titanium AM Platform APIs
 * Enforces Physical Input Validation, CORS Security, and Provenance Metadata.
 */

const ALLOWED_ORIGINS = [
  'https://nit-titanium-am-platform.vercel.app',
  'https://nitt-am-platform.vercel.app',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

export function setCorsHeaders(req, res) {
  const origin = req.headers ? req.headers.origin : null;
  res.setHeader('Vary', 'Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' blob: 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

const _rateBuckets = new Map();

function getClientIp(req) {
  const fwd = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim().slice(0, 64);
  }
  return req?.socket?.remoteAddress || 'unknown';
}

export function checkRateLimit(req, { windowMs = 60000, maxRequests = 60, prefix = 'api' } = {}) {
  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  let timestamps = _rateBuckets.get(key) || [];
  timestamps = timestamps.filter((ts) => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    _rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  _rateBuckets.set(key, timestamps);
  if (_rateBuckets.size > 2000) {
    for (const [k, arr] of _rateBuckets.entries()) {
      if (arr.length === 0 || now - arr[arr.length - 1] >= windowMs) {
        _rateBuckets.delete(k);
      }
    }
  }
  return true;
}

const PROCESS_LIMITS = {
  lpbf: {
    name: 'Laser Powder Bed Fusion (LPBF)',
    power: { min: 20, max: 1000, unit: 'W', default: 280, reason: 'LPBF laser power operates between 20 W and 1000 W for single-mode fiber lasers on Ti-6Al-4V.' },
    speed: { min: 50, max: 4000, unit: 'mm/s', default: 960, reason: 'Galvanometer scan speeds range from 50 mm/s to 4000 mm/s.' },
    hatch: { min: 20, max: 400, unit: 'µm', default: 110, reason: 'Hatch spacing for powder bed fusion is typically between 20 µm and 400 µm.' },
    layer: { min: 10, max: 150, unit: 'µm', default: 40, reason: 'LPBF layer thickness is typically between 10 µm (high precision) and 150 µm.' },
    spot: { min: 20, max: 350, unit: 'µm', default: 80, reason: 'Laser focal spot $1/e^2$ diameter ranges from 20 µm to 350 µm.' },
    preheat: { min: 20, max: 600, unit: '°C', default: 25, reason: 'Substrate preheat temperature ranges from ambient (20°C) to 600°C heated build plates.' }
  },
  'ded-laser': {
    name: 'Blown-Powder Directed Energy Deposition (L-DED)',
    power: { min: 200, max: 6000, unit: 'W', default: 1600, reason: 'Industrial L-DED deposition lasers operate between 200 W and 6000 W.' },
    speed: { min: 2, max: 120, unit: 'mm/s', default: 15, reason: 'CNC / robotic travel speeds range from 2 mm/s to 120 mm/s.' },
    hatch: { min: 200, max: 4000, unit: 'µm', default: 1200, reason: 'Track overlap stepover ranges from 200 µm to 4000 µm.' },
    layer: { min: 100, max: 2500, unit: 'µm', default: 450, reason: 'Powder deposition layer thickness ranges from 100 µm to 2500 µm.' },
    spot: { min: 400, max: 5000, unit: 'µm', default: 1500, reason: 'Coaxial nozzle spot diameter ranges from 400 µm to 5000 µm.' },
    preheat: { min: 20, max: 600, unit: '°C', default: 25, reason: 'Preheat temperature ranges from 20°C to 600°C.' }
  },
  waam: {
    name: 'Wire Arc Additive Manufacturing (WAAM)',
    power: { min: 500, max: 8000, unit: 'W', default: 2400, reason: 'CMT / plasma arc heat input corresponds to 500 W to 8000 W equivalent electrical power.' },
    speed: { min: 1, max: 60, unit: 'mm/s', default: 8, reason: 'Robotic torch travel speed ranges from 1 mm/s to 60 mm/s.' },
    hatch: { min: 1000, max: 10000, unit: 'µm', default: 3500, reason: 'Weld bead stepover pitch ranges from 1000 µm to 10000 µm.' },
    layer: { min: 500, max: 5000, unit: 'µm', default: 1500, reason: 'Single weld layer height ranges from 500 µm to 5000 µm.' },
    spot: { min: 1500, max: 8000, unit: 'µm', default: 3000, reason: 'Effective plasma/arc column footprint diameter is 1500 µm to 8000 µm.' },
    preheat: { min: 20, max: 450, unit: '°C', default: 25, reason: 'Interpass temperature must be monitored and kept ≤150°C to prevent excessive grain coarsening.' }
  },
  'binder-jetting': {
    name: 'Binder Jetting + Sintering (BJT)',
    power: { min: 20, max: 300, unit: 'W', default: 120, reason: 'Binder saturation proxy index (120 nominal -> 65% binder saturation) ranges from 20 to 300.' },
    speed: { min: 20, max: 1000, unit: 'mm/s', default: 250, reason: 'Printhead gantry travel speed ranges from 20 mm/s to 1000 mm/s.' },
    hatch: { min: 20, max: 250, unit: 'µm', default: 50, reason: 'Binder droplet pitch ranges from 20 µm to 250 µm.' },
    layer: { min: 30, max: 200, unit: 'µm', default: 100, reason: 'Powder bed spread layer thickness ranges from 30 µm to 200 µm.' },
    spot: { min: 20, max: 150, unit: 'µm', default: 50, reason: 'Printhead nozzle droplet diameter ranges from 20 µm to 150 µm.' },
    preheat: { min: 20, max: 1450, unit: '°C', default: 1250, reason: 'De-binding / vacuum sintering furnace temperature ranges from 20°C to 1450°C.' }
  }
};

export function normalizeProcessName(raw) {
  if (!raw) return 'lpbf';
  const str = String(raw).toLowerCase().trim();
  if (str.includes('waam') || str.includes('arc') || str.includes('cmt')) return 'waam';
  if (str.includes('ded') || str.includes('lmd') || str.includes('lens')) return 'ded-laser';
  if (str.includes('binder') || str.includes('bj')) return 'binder-jetting';
  return 'lpbf';
}

export function validateProcessInputs(inputs, procKey) {
  const limits = PROCESS_LIMITS[procKey] || PROCESS_LIMITS.lpbf;
  const rejected = [];
  const accepted = {};

  const keys = ['power', 'speed', 'hatch', 'layer', 'spot', 'preheat'];
  for (const k of keys) {
    if (inputs[k] === undefined || inputs[k] === null || inputs[k] === '') {
      // Use default if not supplied
      accepted[k] = limits[k].default;
      continue;
    }

    const val = parseFloat(inputs[k]);
    if (!Number.isFinite(val)) {
      rejected.push({
        parameter: k,
        received_value: inputs[k],
        valid_range: { min: limits[k].min, max: limits[k].max, unit: limits[k].unit },
        reason: `Parameter '${k}' must be a valid finite number.`
      });
      continue;
    }

    if (val < limits[k].min || val > limits[k].max) {
      rejected.push({
        parameter: k,
        received_value: val,
        valid_range: { min: limits[k].min, max: limits[k].max, unit: limits[k].unit },
        reason: `${limits[k].reason} Received: ${val} ${limits[k].unit}. Valid range is [${limits[k].min}, ${limits[k].max}] ${limits[k].unit}.`
      });
    } else {
      accepted[k] = val;
    }
  }

  return {
    valid: rejected.length === 0,
    process: procKey,
    process_name: limits.name,
    rejected_parameters: rejected,
    accepted_parameters: accepted
  };
}

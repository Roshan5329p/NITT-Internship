import { describe, it, expect, beforeEach } from 'vitest';
// @ts-expect-error Untyped UMD browser motion controller
import UiMotion from '../js/ui-motion.js';

declare const require: (id: string) => any;
declare const process: { cwd: () => string };

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('UiMotion zero-dependency motion controller', () => {
  beforeEach(() => {
    UiMotion.resetStateForTest();
  });

  it('exposes the full planned public API', () => {
    const fns = [
      'prefersReducedMotion',
      'isSliderDragging',
      'bindGlobalSliderGuards',
      'initFlutedAuroraObservers',
      'animateCurtainEnter',
      'animateCurtainExit',
      'initSegmentedTrack',
      'syncSegmentedGlider',
      'initPillDock',
      'spawnRipple',
      'syncDock',
      'initRipplePillDock',
      'syncRippleDock',
      'spawnNavTapRipple',
      'initKpiGlider',
      'syncKpiGlider',
      'animateValueTick',
      'animateHeadlineMetrics',
      'triggerSvgStrokeDraw',
      'animateStaggeredBars',
      'animateCanvasWipe',
      'createCanvasDiagonalHatch',
      'syncAll',
      'refreshAll'
    ];
    for (const fn of fns) {
      expect(typeof UiMotion[fn]).toBe('function');
    }
  });

  it('safely short-circuits animateCurtainExit callback when no element is supplied', () => {
    let called = false;
    UiMotion.animateCurtainExit(null, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('returns null safely when Canvas context is unavailable', () => {
    expect(UiMotion.createCanvasDiagonalHatch(null, '#38bdf8')).toBeNull();
  });

  it('reports slider-drag state safely and wires dashboard + methodology HTML', () => {
    expect(UiMotion.isSliderDragging()).toBe(false);

    const dashPath = path.resolve(process.cwd(), 'process_windows_dashboard.html');
    const methPath = path.resolve(process.cwd(), 'methodology.html');
    const dashHtml = fs.readFileSync(dashPath, 'utf8');
    const methHtml = fs.readFileSync(methPath, 'utf8');

    expect(dashHtml).toContain('<script defer src="js/ui-motion.js"></script>');
    expect(methHtml).toContain('<script defer src="js/ui-motion.js"></script>');
    expect(dashHtml).toContain('id="fxDiagonalHatch"');
    expect(dashHtml).toContain('fx-aurora-fluted');
    expect(dashHtml).toContain('fx-kpi-glide-grid');
    expect(dashHtml).toContain('fx-pill-dock');
    expect(dashHtml).toContain('nav-dock-shell');
    expect(dashHtml).toContain('nav-dock-carousel');
    expect(dashHtml).toContain('nav-pill-glider');
    expect(dashHtml).toContain('nav-tap-ripple');
    expect(dashHtml).toContain('process-dock-shell');
    expect(dashHtml).toContain('role="radiogroup"');
    expect(dashHtml).toContain('role="tablist"');
    expect(dashHtml).toContain('fx-segmented-track');
    expect(dashHtml).toContain('prefers-reduced-motion: reduce');
    expect(methHtml).toContain('class="fx-aurora-fluted"');
  });

  it('stages js/ui-motion.js into public/ via stage_vercel_public.mjs', () => {
    execSync('node scripts/stage_vercel_public.mjs', { stdio: 'pipe' });
    const stagedJs = path.resolve(process.cwd(), 'public', 'js', 'ui-motion.js');
    const stagedMeth = path.resolve(process.cwd(), 'public', 'methodology.html');
    const stagedDash = path.resolve(process.cwd(), 'public', 'process_windows_dashboard.html');
    expect(fs.existsSync(stagedJs)).toBe(true);
    expect(fs.existsSync(stagedMeth)).toBe(true);
    expect(fs.existsSync(stagedDash)).toBe(true);
    expect(fs.readFileSync(stagedDash, 'utf8')).toContain('fx-aurora-fluted');
  });
});

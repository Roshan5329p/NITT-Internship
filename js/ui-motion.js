/**
 * MatSci Navigator — Zero-Dependency UI Motion System (js/ui-motion.js)
 * Implements four GPU-composited motion primitives:
 *   1. Fluted-Glass Aurora Backdrop lifecycle observer (pause off-screen / hidden tab)
 *   2. Curtain Pill-to-Card Reveal & Segmented Track Glider + Staggered Bars
 *   3. Tactile Ripple Pill Dock & Focus Slide
 *   4. Gliding Active KPI Highlight Tile + SVG Stroke Draw-In + 45 deg Diagonal Hatch
 * Strictly honors prefers-reduced-motion, 0% idle RAF, and slider-drag responsiveness.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.UiMotion = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SLIDER_SETTLE_MS = 140;
  let sliderDragging = false;
  let sliderReleaseTimer = null;
  let auroraObserver = null;
  let visibilityBound = false;
  let sliderListenersBound = false;
  let resizeObservers = [];
  const hatchPatternCache = new WeakMap();

  function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    try {
      return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_err) {
      return false;
    }
  }

  function isSliderDragging() {
    return sliderDragging;
  }

  function _markSliderActive() {
    sliderDragging = true;
    if (sliderReleaseTimer) {
      clearTimeout(sliderReleaseTimer);
      sliderReleaseTimer = null;
    }
  }

  function _scheduleSliderRelease() {
    if (sliderReleaseTimer) {
      clearTimeout(sliderReleaseTimer);
    }
    sliderReleaseTimer = setTimeout(() => {
      sliderDragging = false;
      sliderReleaseTimer = null;
    }, SLIDER_SETTLE_MS);
  }

  function bindGlobalSliderGuards() {
    if (sliderListenersBound || typeof document === 'undefined') return;
    sliderListenersBound = true;

    const isRangeInput = (t) => t && t.tagName === 'INPUT' && t.type === 'range';

    document.addEventListener('pointerdown', (e) => {
      if (isRangeInput(e.target)) _markSliderActive();
    }, true);

    document.addEventListener('touchstart', (e) => {
      if (isRangeInput(e.target)) _markSliderActive();
    }, { capture: true, passive: true });

    document.addEventListener('input', (e) => {
      if (isRangeInput(e.target)) {
        _markSliderActive();
        _scheduleSliderRelease();
      }
    }, true);

    document.addEventListener('pointerup', () => {
      if (sliderDragging) _scheduleSliderRelease();
    }, true);

    document.addEventListener('touchend', () => {
      if (sliderDragging) _scheduleSliderRelease();
    }, { capture: true, passive: true });

    document.addEventListener('change', (e) => {
      if (isRangeInput(e.target)) _scheduleSliderRelease();
    }, true);
  }

  // -------------------------------------------------------
  // 1. Fluted-Glass Aurora Backdrop Observers
  // -------------------------------------------------------
  function _syncAuroraVisibility() {
    if (typeof document === 'undefined') return;
    const hidden = Boolean(document.hidden);
    document.querySelectorAll('.fx-aurora-fluted').forEach((el) => {
      const offscreen = el.dataset.fxOffscreen === '1';
      el.classList.toggle('fx-aurora-paused', hidden || offscreen || prefersReducedMotion());
    });
  }

  function initFlutedAuroraObservers() {
    if (typeof document === 'undefined') return;
    const targets = Array.from(document.querySelectorAll('.fx-aurora-fluted'));
    if (!targets.length) return;

    if (!visibilityBound) {
      visibilityBound = true;
      document.addEventListener('visibilitychange', _syncAuroraVisibility);
    }

    if (typeof IntersectionObserver === 'function') {
      if (!auroraObserver) {
        auroraObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            entry.target.dataset.fxOffscreen = entry.isIntersecting ? '0' : '1';
          });
          _syncAuroraVisibility();
        }, { threshold: 0.01 });
      }
      targets.forEach((el) => {
        if (!el.dataset.fxAuroraObserved) {
          el.dataset.fxAuroraObserved = '1';
          el.dataset.fxOffscreen = '0';
          auroraObserver.observe(el);
        }
      });
    }
    _syncAuroraVisibility();
  }

  // -------------------------------------------------------
  // 2. Curtain Pill-to-Card Reveal & Staggered Bars
  // -------------------------------------------------------
  function animateCurtainEnter(el) {
    if (!el || prefersReducedMotion() || sliderDragging) return;
    el.classList.remove('fx-curtain-exit', 'fx-curtain-enter');
    void el.offsetWidth;
    el.classList.add('fx-curtain-enter');

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.remove('fx-curtain-enter');
    };
    el.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 460);
  }

  function animateCurtainExit(el, onDone) {
    const callback = typeof onDone === 'function' ? onDone : () => {};
    if (!el || prefersReducedMotion()) {
      if (el) el.classList.remove('fx-curtain-enter', 'fx-curtain-exit');
      callback();
      return;
    }
    el.classList.remove('fx-curtain-enter', 'fx-curtain-exit');
    void el.offsetWidth;
    el.classList.add('fx-curtain-exit');

    let finished = false;
    const complete = () => {
      if (finished) return;
      finished = true;
      el.classList.remove('fx-curtain-exit');
      callback();
    };
    el.addEventListener('animationend', complete, { once: true });
    setTimeout(complete, 280);
  }

  function animateStaggeredBars(containerEl) {
    if (typeof document === 'undefined' || prefersReducedMotion() || sliderDragging) return;
    const scope = containerEl || document;
    const bars = scope.querySelectorAll('.bars-container .bar-pill, #shapBarsContainer .shap-bar-fill, .audit-bar-fill');
    if (!bars.length) return;

    bars.forEach((bar, idx) => {
      const delayMs = Math.min(250, idx * 25);
      bar.style.setProperty('--fx-delay', `${delayMs}ms`);
      bar.classList.remove('fx-bar-stagger');
      void bar.offsetWidth;
      bar.classList.add('fx-bar-stagger');
      bar.addEventListener('animationend', () => {
        bar.classList.remove('fx-bar-stagger');
      }, { once: true });
    });
  }

  // -------------------------------------------------------
  // Shared Glider Positioning Helper
  // -------------------------------------------------------
  function _measureRelativeRect(container, target) {
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const sl = container.scrollLeft || 0;
    const st = container.scrollTop || 0;
    return {
      x: tRect.left - cRect.left + sl,
      y: tRect.top - cRect.top + st,
      w: tRect.width,
      h: tRect.height
    };
  }

  // -------------------------------------------------------
  // 2B. Segmented Track Glider (.fx-segmented-track)
  // -------------------------------------------------------
  function syncSegmentedGlider(container) {
    if (!container) return;
    const glider = container.querySelector(':scope > .fx-seg-glider');
    if (!glider) return;

    const activeBtn = container.querySelector('.mat-state-btn.active, .mp-pill-btn.active, .mp-toggle-btn.active, button.active');
    if (!activeBtn) {
      glider.style.opacity = '0';
      return;
    }
    const r = _measureRelativeRect(container, activeBtn);
    if (r.w <= 0 || r.h <= 0) {
      glider.style.opacity = '0';
      return;
    }
    glider.style.opacity = '1';
    glider.style.width = `${r.w.toFixed(1)}px`;
    glider.style.height = `${r.h.toFixed(1)}px`;
    glider.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
  }

  function initSegmentedTrack(container) {
    if (!container || container.dataset.fxSegInit === '1') {
      syncSegmentedGlider(container);
      return;
    }
    container.dataset.fxSegInit = '1';

    let glider = container.querySelector(':scope > .fx-seg-glider');
    if (!glider && typeof document !== 'undefined') {
      glider = document.createElement('span');
      glider.className = 'fx-seg-glider';
      glider.setAttribute('aria-hidden', 'true');
      container.insertBefore(glider, container.firstChild);
    }

    container.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
      const btn = e.target.closest('button');
      if (btn && container.contains(btn)) {
        requestAnimationFrame(() => syncSegmentedGlider(container));
      }
    });

    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => syncSegmentedGlider(container));
      ro.observe(container);
      resizeObservers.push(ro);
    }

    syncSegmentedGlider(container);
  }

  // -------------------------------------------------------
  // 3. Tactile Ripple Pill Dock & Focus Slide (.fx-pill-dock)
  // -------------------------------------------------------
  function spawnRipple(btn, event) {
    if (!btn || prefersReducedMotion() || sliderDragging || typeof document === 'undefined') return;
    btn.querySelectorAll(':scope > .fx-ripple').forEach((old) => old.remove());

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height, 44) * 1.65;
    let cx = rect.width / 2;
    let cy = rect.height / 2;
    if (event && typeof event.clientX === 'number' && event.clientX > 0 && rect.width > 0) {
      cx = event.clientX - rect.left;
      cy = event.clientY - rect.top;
    }

    const ripple = document.createElement('span');
    ripple.className = 'fx-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${cx - size / 2}px`;
    ripple.style.top = `${cy - size / 2}px`;

    btn.appendChild(ripple);
    const cleanup = () => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    };
    ripple.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 480);
  }

  function syncDock(container, shouldScrollCenter) {
    if (!container) return;
    const glider = container.querySelector(':scope > .fx-dock-glider');
    if (!glider) return;

    const activeItem = container.querySelector('.tab-btn.active, .process-pill.active, .twin-mode-btn.active, .showcase-stage-pill.active, button.active');
    if (!activeItem) {
      glider.style.opacity = '0';
      return;
    }

    const r = _measureRelativeRect(container, activeItem);
    if (r.w <= 0 || r.h <= 0) {
      glider.style.opacity = '0';
      return;
    }

    glider.style.opacity = '1';
    glider.style.width = `${r.w.toFixed(1)}px`;
    glider.style.height = `${r.h.toFixed(1)}px`;
    glider.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;

    if (shouldScrollCenter && container.scrollWidth > container.clientWidth + 4 && typeof container.scrollTo === 'function') {
      const targetLeft = Math.max(0, r.x - (container.clientWidth - r.w) / 2);
      container.scrollTo({
        left: targetLeft,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    }
  }

  function initPillDock(container) {
    if (!container || container.dataset.fxDockInit === '1') {
      syncDock(container, false);
      return;
    }
    container.dataset.fxDockInit = '1';

    let glider = container.querySelector(':scope > .fx-dock-glider');
    if (!glider && typeof document !== 'undefined') {
      glider = document.createElement('span');
      glider.className = 'fx-dock-glider';
      glider.setAttribute('aria-hidden', 'true');
      container.insertBefore(glider, container.firstChild);
    }

    container.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
      const item = e.target.closest('button, .process-pill, .tab-btn, .showcase-stage-pill, .twin-mode-btn');
      if (!item || !container.contains(item)) return;
      spawnRipple(item, e);
      requestAnimationFrame(() => syncDock(container, true));
    });

    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => syncDock(container, false));
      ro.observe(container);
      resizeObservers.push(ro);
    }

    syncDock(container, false);
  }

  // -------------------------------------------------------
  // 4. Gliding Active KPI Card Highlight + Value Tick
  // -------------------------------------------------------
  function animateValueTick(valueEl) {
    if (!valueEl || prefersReducedMotion() || sliderDragging) return;
    valueEl.classList.remove('fx-val-tick');
    void valueEl.offsetWidth;
    valueEl.classList.add('fx-val-tick');
    valueEl.addEventListener('animationend', () => {
      valueEl.classList.remove('fx-val-tick');
    }, { once: true });
  }

  function animateHeadlineMetrics(rootEl) {
    if (typeof document === 'undefined' || prefersReducedMotion() || sliderDragging) return;
    const scope = rootEl || document;
    scope.querySelectorAll('.kpi-value, #valPeakStress, #valCoreStress').forEach(animateValueTick);
  }

  function syncKpiGlider(gridEl) {
    if (!gridEl) return;
    const glider = gridEl.querySelector(':scope > .fx-kpi-active-glider');
    if (!glider) return;

    const cards = Array.from(gridEl.querySelectorAll(':scope > .kpi-card, :scope > .bar-col, :scope > .fx-glide-card'));
    if (!cards.length) {
      glider.style.opacity = '0';
      return;
    }

    let selected = cards.find((c) => c.classList.contains('fx-kpi-selected') || c.classList.contains('active'));
    if (!selected) {
      selected = cards[0];
      selected.classList.add('fx-kpi-selected');
    }

    const r = _measureRelativeRect(gridEl, selected);
    if (r.w <= 0 || r.h <= 0) {
      glider.style.opacity = '0';
      return;
    }

    const extraBottom = Number(gridEl.dataset.fxGliderPadBottom || '0');
    glider.style.opacity = '1';
    glider.style.width = `${r.w.toFixed(1)}px`;
    glider.style.height = `${(r.h + extraBottom).toFixed(1)}px`;
    glider.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
  }

  function initKpiGlider(gridEl) {
    if (!gridEl) return;
    if (gridEl.dataset.fxKpiInit === '1') {
      syncKpiGlider(gridEl);
      return;
    }
    gridEl.dataset.fxKpiInit = '1';

    let glider = gridEl.querySelector(':scope > .fx-kpi-active-glider');
    if (!glider && typeof document !== 'undefined') {
      glider = document.createElement('div');
      glider.className = 'fx-kpi-active-glider';
      glider.setAttribute('aria-hidden', 'true');
      gridEl.insertBefore(glider, gridEl.firstChild);
    }

    const cards = Array.from(gridEl.querySelectorAll(':scope > .kpi-card, :scope > .bar-col, :scope > .fx-glide-card'));
    cards.forEach((card) => {
      if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
      if (!card.hasAttribute('role') && card.tagName !== 'BUTTON') card.setAttribute('role', 'button');
    });

    const activateCard = (card, e) => {
      cards.forEach((c) => c.classList.remove('fx-kpi-selected'));
      card.classList.add('fx-kpi-selected');
      syncKpiGlider(gridEl);

      const valEl = card.querySelector('.kpi-value, .bar-pill, .fx-card-headline');
      if (valEl) animateValueTick(valEl);

      if (typeof document !== 'undefined') {
        const predView = document.getElementById('view_predictions');
        if (predView && predView.contains(card) || gridEl.classList.contains('kpi-row')) {
          triggerSvgStrokeDraw(predView || document);
        }
      }
      if (e && typeof spawnRipple === 'function' && card.classList.contains('fx-glide-card')) {
        spawnRipple(card, e);
      }
    };

    gridEl.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
      const card = e.target.closest('.kpi-card, .bar-col, .fx-glide-card');
      if (!card || card.parentElement !== gridEl) return;
      activateCard(card, e);
    });

    gridEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!(e.target instanceof Element)) return;
      const card = e.target.closest('.kpi-card, .bar-col, .fx-glide-card');
      if (!card || card.parentElement !== gridEl) return;
      e.preventDefault();
      if (typeof card.click === 'function') card.click();
      else activateCard(card, e);
    });

    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => syncKpiGlider(gridEl));
      ro.observe(gridEl);
      resizeObservers.push(ro);
    }

    syncKpiGlider(gridEl);
  }

  // -------------------------------------------------------
  // 4B. SVG Stroke Draw-In & Diagonal Hatch Helpers
  // -------------------------------------------------------
  function triggerSvgStrokeDraw(rootEl) {
    if (typeof document === 'undefined' || prefersReducedMotion() || sliderDragging) return;
    const scope = rootEl || document;

    const strokes = scope.querySelectorAll('svg .fx-svg-draw');
    strokes.forEach((el) => {
      if (el.offsetParent === null && (!el.ownerSVGElement || el.ownerSVGElement.offsetParent === null)) return;
      let len = 0;
      try {
        if (typeof el.getTotalLength === 'function') {
          len = el.getTotalLength();
        }
      } catch (_err) {
        len = 0;
      }

      if (Number.isFinite(len) && len > 2 && typeof el.animate === 'function') {
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
        const anim = el.animate(
          [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
          { duration: 450, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        );
        anim.onfinish = () => {
          el.style.strokeDasharray = '';
          el.style.strokeDashoffset = '';
        };
      } else {
        el.classList.remove('fx-stroke-wipe');
        void el.offsetWidth;
        el.classList.add('fx-stroke-wipe');
      }
    });

    const areas = scope.querySelectorAll('svg .fx-hatch-area');
    areas.forEach((area) => {
      if (typeof area.animate === 'function') {
        area.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 280, easing: 'ease-out', fill: 'forwards' }
        );
      }
    });
  }

  function animateCanvasWipe(canvasEl) {
    if (!canvasEl || prefersReducedMotion() || sliderDragging || typeof canvasEl.animate !== 'function') return;
    canvasEl.animate(
      [
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)' }
      ],
      { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
  }

  function createCanvasDiagonalHatch(ctx, strokeColor) {
    if (!ctx || typeof document === 'undefined' || typeof ctx.createPattern !== 'function') {
      return null;
    }
    const color = strokeColor || 'rgba(56, 189, 248, 0.22)';
    let colorMap = hatchPatternCache.get(ctx);
    if (colorMap && colorMap.has(color)) {
      return colorMap.get(color);
    }

    const tile = document.createElement('canvas');
    tile.width = 10;
    tile.height = 10;
    const tctx = tile.getContext('2d');
    if (!tctx) return null;

    tctx.strokeStyle = color;
    tctx.lineWidth = 1.25;
    tctx.beginPath();
    tctx.moveTo(-2, 10);
    tctx.lineTo(10, -2);
    tctx.moveTo(0, 12);
    tctx.lineTo(12, 0);
    tctx.stroke();

    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      if (!colorMap) {
        colorMap = new Map();
        hatchPatternCache.set(ctx, colorMap);
      }
      colorMap.set(color, pat);
    }
    return pat;
  }

  // -------------------------------------------------------
  // Global Sync & Boot
  // -------------------------------------------------------
  function syncAll() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.fx-segmented-track').forEach(syncSegmentedGlider);
    document.querySelectorAll('.fx-pill-dock').forEach((d) => syncDock(d, false));
    document.querySelectorAll('.fx-kpi-glide-grid').forEach(syncKpiGlider);
    _syncAuroraVisibility();
  }

  function refreshAll() {
    if (typeof document === 'undefined') return;
    bindGlobalSliderGuards();
    initFlutedAuroraObservers();
    document.querySelectorAll('.fx-segmented-track').forEach(initSegmentedTrack);
    document.querySelectorAll('.fx-pill-dock').forEach(initPillDock);
    document.querySelectorAll('.fx-kpi-glide-grid').forEach(initKpiGlider);
    syncAll();
  }

  function _setActiveModelGliderById(modelId) {
    if (typeof document === 'undefined' || !modelId) return;
    const cols = document.querySelectorAll('.bars-container .bar-col');
    if (!cols.length) return;
    cols.forEach((col) => {
      const handler = col.getAttribute('onclick') || '';
      const isMatch = handler.includes(`'${modelId}'`);
      col.classList.toggle('fx-kpi-selected', isMatch);
    });
    const grid = document.querySelector('.bars-container.fx-kpi-glide-grid');
    if (grid) syncKpiGlider(grid);
  }

  function resetStateForTest() {
    sliderDragging = false;
    if (sliderReleaseTimer) {
      clearTimeout(sliderReleaseTimer);
      sliderReleaseTimer = null;
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        refreshAll();
        requestAnimationFrame(syncAll);
      });
    } else {
      refreshAll();
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq && typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', _syncAuroraVisibility);
        }
      } catch (_err) {
        // Ignore older browsers without MediaQueryList.addEventListener
      }
    }
  }

  return {
    prefersReducedMotion,
    isSliderDragging,
    bindGlobalSliderGuards,
    initFlutedAuroraObservers,
    animateCurtainEnter,
    animateCurtainExit,
    initSegmentedTrack,
    syncSegmentedGlider,
    initPillDock,
    spawnRipple,
    syncDock,
    initKpiGlider,
    syncKpiGlider,
    animateValueTick,
    animateHeadlineMetrics,
    triggerSvgStrokeDraw,
    animateStaggeredBars,
    animateCanvasWipe,
    createCanvasDiagonalHatch,
    syncActiveModelBar: _setActiveModelGliderById,
    syncAll,
    refreshAll,
    resetStateForTest
  };
});

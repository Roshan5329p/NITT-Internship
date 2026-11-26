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
  // 3B. Reusable Ripple-and-Glide Pill Dock Carousel (.nav-dock-shell)
  // -------------------------------------------------------
  function spawnNavTapRipple(dockEl, btn, event) {
    if (!dockEl || prefersReducedMotion() || sliderDragging || typeof document === 'undefined') return;
    dockEl.querySelectorAll(':scope > .nav-tap-ripple').forEach((old) => old.remove());

    const dockRect = dockEl.getBoundingClientRect();
    if (!dockRect || dockRect.width <= 0 || dockRect.height <= 0) return;

    let x = dockRect.width / 2;
    let y = dockRect.height / 2;

    if (event && typeof event.clientX === 'number' && event.clientX !== 0 && event.clientY !== 0) {
      x = event.clientX - dockRect.left;
      y = event.clientY - dockRect.top;
    } else if (btn && typeof btn.getBoundingClientRect === 'function') {
      const bRect = btn.getBoundingClientRect();
      x = bRect.left - dockRect.left + bRect.width / 2;
      y = bRect.top - dockRect.top + bRect.height / 2;
    }

    const ripple = document.createElement('span');
    ripple.className = 'nav-tap-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${x.toFixed(1)}px`;
    ripple.style.top = `${y.toFixed(1)}px`;

    dockEl.appendChild(ripple);
    const cleanup = () => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    };
    ripple.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 520);
  }

  function _getDockItems(track) {
    if (!track) return [];
    return Array.from(
      track.querySelectorAll(':scope > .tab-btn, :scope > .process-pill, :scope > button[role="tab"], :scope > [role="radio"]')
    );
  }

  function syncRippleDock(dockEl, opts) {
    if (!dockEl) return;
    const options = opts || {};
    const track = dockEl.querySelector('.nav-dock-track') || dockEl;
    const glider = track.querySelector(':scope > .nav-pill-glider');
    if (!glider) return;

    const activeItem = track.querySelector('.tab-btn.active, .process-pill.active, [aria-selected="true"], [aria-checked="true"], button.active');
    if (!activeItem) {
      glider.style.opacity = '0';
      return;
    }

    const noTransition = Boolean(options.instant) || prefersReducedMotion();
    if (noTransition) {
      glider.classList.add('fx-no-transition');
    }

    const left = activeItem.offsetLeft;
    const top = activeItem.offsetTop;
    const width = activeItem.offsetWidth;
    const height = activeItem.offsetHeight;

    if (width <= 0 || height <= 0) {
      glider.style.opacity = '0';
      if (noTransition) glider.classList.remove('fx-no-transition');
      return;
    }

    glider.style.opacity = '1';
    glider.style.width = `${width.toFixed(1)}px`;
    glider.style.height = `${height.toFixed(1)}px`;
    glider.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`;

    if (noTransition && typeof requestAnimationFrame === 'function') {
      void glider.offsetWidth;
      requestAnimationFrame(() => glider.classList.remove('fx-no-transition'));
    }

    const dockOpts = dockEl._fxDockOpts || { centerOnSelect: true };
    const shouldCenter = options.center !== undefined ? Boolean(options.center) : Boolean(dockOpts.centerOnSelect);
    if (shouldCenter && track.scrollWidth > track.clientWidth + 4 && typeof track.scrollTo === 'function') {
      const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
      const targetLeft = Math.max(0, Math.min(maxScroll, left - (track.clientWidth - width) / 2));
      track.scrollTo({
        left: targetLeft,
        behavior: (options.instant || prefersReducedMotion()) ? 'auto' : 'smooth'
      });
    }

    if (options.rippleOnActive) {
      spawnNavTapRipple(dockEl, activeItem, null);
    }
  }

  function initRipplePillDock(dockEl, options) {
    if (!dockEl) return;
    const opts = Object.assign(
      {
        centerOnSelect: dockEl.dataset.centerOnSelect !== 'false',
        compactCarousel: dockEl.dataset.compactCarousel === 'true'
      },
      options || {}
    );
    dockEl._fxDockOpts = opts;

    if (dockEl.dataset.fxRippleDockInit === '1') {
      syncRippleDock(dockEl, { center: false, instant: true });
      return;
    }
    dockEl.dataset.fxRippleDockInit = '1';

    const track = dockEl.querySelector('.nav-dock-track') || dockEl;
    let glider = track.querySelector(':scope > .nav-pill-glider');
    if (!glider && typeof document !== 'undefined') {
      glider = document.createElement('span');
      glider.className = 'nav-pill-glider';
      glider.setAttribute('aria-hidden', 'true');
      track.insertBefore(glider, track.firstChild);
    }

    let suppressNextClick = false;

    track.addEventListener('click', (e) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!(e.target instanceof Element)) return;
      const item = e.target.closest('.tab-btn, .process-pill, button[role="tab"], [role="radio"]');
      if (!item || !track.contains(item)) return;
      spawnNavTapRipple(dockEl, item, e);
      const runSync = () => syncRippleDock(dockEl, { center: opts.centerOnSelect });
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(runSync);
      } else {
        runSync();
      }
    });

    track.addEventListener('keydown', (e) => {
      if (!(e.target instanceof Element)) return;
      const items = _getDockItems(track);
      if (!items.length) return;
      const current = e.target.closest('.tab-btn, .process-pill, button[role="tab"], [role="radio"]');
      const idx = current ? items.indexOf(current) : -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        let nextIdx = 0;
        if (e.key === 'ArrowRight') nextIdx = idx >= 0 ? (idx + 1) % items.length : 0;
        else if (e.key === 'ArrowLeft') nextIdx = idx >= 0 ? (idx - 1 + items.length) % items.length : items.length - 1;
        else if (e.key === 'End') nextIdx = items.length - 1;

        const targetItem = items[nextIdx];
        if (targetItem) {
          targetItem.focus();
          spawnNavTapRipple(dockEl, targetItem, null);
          if (typeof targetItem.click === 'function') targetItem.click();
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => syncRippleDock(dockEl, { center: opts.centerOnSelect }));
          }
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && current && current.tagName !== 'BUTTON') {
        e.preventDefault();
        spawnNavTapRipple(dockEl, current, null);
        if (typeof current.click === 'function') current.click();
      }
    });

    // Vertical mouse wheel over horizontally scrollable carousel translates smoothly to horizontal scroll
    dockEl.addEventListener('wheel', (e) => {
      if (track.scrollWidth <= track.clientWidth + 2) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        track.scrollLeft += e.deltaY * 0.9;
      }
    }, { passive: false });

    // Left/Right chevron buttons for effortless mouse scrolling
    const prevBtn = dockEl.querySelector(':scope > .nav-scroll-btn.prev');
    const nextBtn = dockEl.querySelector(':scope > .nav-scroll-btn.next');
    const scrollByStep = (dir) => {
      if (typeof track.scrollBy === 'function') {
        track.scrollBy({ left: dir * 220, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      } else {
        track.scrollLeft += dir * 220;
      }
    };
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollByStep(-1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        scrollByStep(1);
      });
    }

    // Mouse click-drag scrolling for compact carousel (window-scoped move/up so cursor drift never drops drag)
    let dragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let moved = false;

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || track.scrollWidth <= track.clientWidth + 2) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScrollLeft = track.scrollLeft;
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 5) {
          moved = true;
          track.classList.add('is-dragging');
          track.scrollLeft = startScrollLeft - dx;
        }
      });

      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        if (moved) {
          suppressNextClick = true;
          setTimeout(() => { suppressNextClick = false; }, 60);
        }
      };
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    }

    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(() => syncRippleDock(dockEl, { center: false, instant: true }));
      ro.observe(dockEl);
      if (track !== dockEl) ro.observe(track);
      resizeObservers.push(ro);
    }

    syncRippleDock(dockEl, { center: opts.centerOnSelect, instant: true });
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
    document.querySelectorAll('.nav-dock-shell').forEach((d) => syncRippleDock(d, { center: false }));
    document.querySelectorAll('.fx-kpi-glide-grid').forEach(syncKpiGlider);
    _syncAuroraVisibility();
  }

  function refreshAll() {
    if (typeof document === 'undefined') return;
    bindGlobalSliderGuards();
    initFlutedAuroraObservers();
    document.querySelectorAll('.fx-segmented-track').forEach(initSegmentedTrack);
    document.querySelectorAll('.fx-pill-dock').forEach(initPillDock);
    document.querySelectorAll('.nav-dock-shell').forEach((d) => initRipplePillDock(d));
    document.querySelectorAll('.fx-kpi-glide-grid').forEach(initKpiGlider);
    syncAll();
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(() => {
        document.querySelectorAll('.nav-dock-shell').forEach((d) => syncRippleDock(d, { center: false, instant: true }));
      });
    }
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
    initRipplePillDock,
    syncRippleDock,
    spawnNavTapRipple,
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

(function () {
  'use strict';

  function _getCssVarResolver() {
    var rootStyle = typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement) : null;
    return function resolveCssVars(str) {
      if (!str || typeof str !== 'string' || str.indexOf('var(') === -1 || !rootStyle) return str;
      return str.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g, function (_m, varName, fallback) {
        var val = rootStyle.getPropertyValue(varName).trim();
        return val || (fallback ? fallback.trim() : '');
      });
    };
  }

  function _resolveCssVarsInSvg(svgClone) {
    var resolve = _getCssVarResolver();
    var attrs = ['fill', 'stroke', 'stop-color', 'color', 'background', 'border-color'];
    var walk = function (node) {
      if (!node || node.nodeType !== 1) return;
      for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i];
        if (node.hasAttribute(a)) {
          var v = node.getAttribute(a);
          if (v && v.indexOf('var(') !== -1) node.setAttribute(a, resolve(v));
        }
      }
      if (node.hasAttribute('style')) {
        var st = node.getAttribute('style');
        if (st && st.indexOf('var(') !== -1) node.setAttribute('style', resolve(st));
      }
      var children = node.children;
      for (var c = 0; c < children.length; c++) {
        walk(children[c]);
      }
    };
    walk(svgClone);
  }

  function _getSvgDimensions(svgEl) {
    var vb = svgEl.getAttribute('viewBox');
    if (vb) {
      var parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { w: Math.round(parts[2]), h: Math.round(parts[3]) };
      }
    }
    var rect = svgEl.getBoundingClientRect ? svgEl.getBoundingClientRect() : null;
    if (rect && rect.width > 10 && rect.height > 10) {
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    }
    return { w: 760, h: 360 };
  }

  function _getActiveProcessSlug() {
    var phys = (typeof window !== 'undefined' && window.latestPhysicsState) ? window.latestPhysicsState : {};
    var proc = String(phys.process || (typeof window !== 'undefined' && window.currentProcess) || 'lpbf')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    return proc || 'lpbf';
  }

  function _getMetadataStamp() {
    var phys = (typeof window !== 'undefined' && window.latestPhysicsState) ? window.latestPhysicsState : {};
    var proc = String(phys.process || (typeof window !== 'undefined' && window.currentProcess) || 'LPBF').toUpperCase();
    var p = Number.isFinite(Number(phys.p)) ? Math.round(Number(phys.p)) : null;
    var v = Number.isFinite(Number(phys.v)) ? Number(phys.v) : null;
    var ved = Number.isFinite(Number(phys.ved)) ? Number(phys.ved).toFixed(1) : null;
    var post = String(phys.post || 'HIP');
    var bits = ['Ti-6Al-4V', proc];
    if (p !== null && v !== null) bits.push(p + ' W / ' + v + ' mm/s');
    if (ved !== null) bits.push('VED ' + ved + ' J/mm³');
    bits.push(post);
    return bits.join(' • ');
  }

  function _isLightTheme() {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('light');
  }

  function _triggerPngDownload(dataUrl, filename) {
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = String(filename || 'matsci-graph.png').replace(/[^a-zA-Z0-9_.-]/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function _svgToLoadedImage(svgEl) {
    return new Promise(function (resolve, reject) {
      var dims = _getSvgDimensions(svgEl);
      var clone = svgEl.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      clone.setAttribute('width', String(dims.w));
      clone.setAttribute('height', String(dims.h));
      clone.style.width = dims.w + 'px';
      clone.style.height = dims.h + 'px';
      _resolveCssVarsInSvg(clone);

      var xml = new XMLSerializer().serializeToString(clone);
      var blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({ img: img, w: dims.w, h: dims.h });
      };
      img.onerror = function (err) {
        URL.revokeObjectURL(url);
        reject(err || new Error('Failed to decode SVG for PNG export'));
      };
      img.src = url;
    });
  }

  function _elementToDrawable(el, overlayCanvasId) {
    if (!el) return Promise.reject(new Error('Missing chart element'));
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'canvas') {
      var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      var w = (rect && rect.width > 20) ? Math.round(rect.width) : (el.width || 760);
      var h = (rect && rect.height > 20) ? Math.round(rect.height) : (el.height || 320);
      return Promise.resolve({ canvas: el, w: w, h: h, overlay: null });
    }
    if (tag === 'svg') {
      return _svgToLoadedImage(el).then(function (loaded) {
        var overlayEl = overlayCanvasId ? document.getElementById(overlayCanvasId) : null;
        return { img: loaded.img, w: loaded.w, h: loaded.h, overlay: overlayEl };
      });
    }
    return Promise.reject(new Error('Unsupported chart tag: ' + tag));
  }

  function _drawItemOntoCanvas(ctx, item, x, y, drawW, drawH, lightTheme) {
    var innerBg = lightTheme ? '#f8fafc' : '#060a11';
    ctx.save();
    ctx.fillStyle = innerBg;
    ctx.strokeStyle = lightTheme ? '#cbd5e1' : '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, drawW, drawH, 8);
    } else {
      ctx.rect(x, y, drawW, drawH);
    }
    ctx.fill();
    ctx.stroke();
    ctx.clip();

    if (item.canvas) {
      ctx.drawImage(item.canvas, x, y, drawW, drawH);
    } else if (item.img) {
      ctx.drawImage(item.img, x, y, drawW, drawH);
      if (item.overlay && item.overlay.width > 0 && item.overlay.height > 0) {
        ctx.drawImage(item.overlay, x, y, drawW, drawH);
      }
    }
    ctx.restore();
  }

  function downloadDashboardGraph(elementId, slug, titleText, options) {
    var el = document.getElementById(elementId);
    if (!el) return Promise.resolve(false);
    var opts = options || {};
    var safeSlug = String(slug || elementId || 'graph').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    var filename = 'matsci-' + safeSlug + '-' + _getActiveProcessSlug() + '.png';

    return _elementToDrawable(el, opts.overlayCanvasId || null).then(function (item) {
      var lightTheme = _isLightTheme();
      var pad = 20;
      var headerH = titleText ? 38 : 14;
      var footerH = 30;
      var minW = 540;
      var targetW = Math.max(minW, item.w);
      var drawH = Math.round(item.h * (targetW / Math.max(1, item.w)));
      var totalW = targetW + pad * 2;
      var totalH = drawH + headerH + footerH + pad * 2;
      var scale = 2;

      var out = document.createElement('canvas');
      out.width = totalW * scale;
      out.height = totalH * scale;
      var ctx = out.getContext('2d');
      ctx.scale(scale, scale);

      ctx.fillStyle = lightTheme ? '#ffffff' : '#070b14';
      ctx.fillRect(0, 0, totalW, totalH);

      if (titleText) {
        ctx.fillStyle = lightTheme ? '#0f172a' : '#f8fafc';
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(titleText), pad, pad + 12);
      }

      _drawItemOntoCanvas(ctx, item, pad, pad + headerH, targetW, drawH, lightTheme);

      ctx.fillStyle = lightTheme ? '#475569' : '#94a3b8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(_getMetadataStamp(), totalW - pad, totalH - pad * 0.5 - 2);

      _triggerPngDownload(out.toDataURL('image/png'), filename);
      return true;
    }).catch(function (err) {
      console.error('Chart PNG export failed for #' + elementId + ':', err);
      return false;
    });
  }

  function downloadDashboardGraphGroup(elementIds, slug, groupTitle) {
    if (!Array.isArray(elementIds) || !elementIds.length) return Promise.resolve(false);
    var safeSlug = String(slug || 'graphs').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    var filename = 'matsci-' + safeSlug + '-' + _getActiveProcessSlug() + '.png';

    var promises = elementIds.map(function (id) {
      return _elementToDrawable(document.getElementById(id), null);
    });

    return Promise.all(promises).then(function (items) {
      var lightTheme = _isLightTheme();
      var pad = 20;
      var gap = 14;
      var headerH = groupTitle ? 40 : 14;
      var footerH = 30;
      var rowH = 0;
      var totalContentW = 0;
      for (var i = 0; i < items.length; i++) {
        rowH = Math.max(rowH, items[i].h);
        totalContentW += items[i].w;
      }
      totalContentW += gap * Math.max(0, items.length - 1);

      var totalW = totalContentW + pad * 2;
      var totalH = rowH + headerH + footerH + pad * 2;
      var scale = 2;

      var out = document.createElement('canvas');
      out.width = totalW * scale;
      out.height = totalH * scale;
      var ctx = out.getContext('2d');
      ctx.scale(scale, scale);

      ctx.fillStyle = lightTheme ? '#ffffff' : '#070b14';
      ctx.fillRect(0, 0, totalW, totalH);

      if (groupTitle) {
        ctx.fillStyle = lightTheme ? '#0f172a' : '#f8fafc';
        ctx.font = 'bold 15px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(groupTitle), pad, pad + 14);
      }

      var curX = pad;
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        var scaledW = Math.round(it.w * (rowH / Math.max(1, it.h)));
        _drawItemOntoCanvas(ctx, it, curX, pad + headerH, scaledW, rowH, lightTheme);
        curX += scaledW + gap;
      }

      ctx.fillStyle = lightTheme ? '#475569' : '#94a3b8';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(_getMetadataStamp(), totalW - pad, totalH - pad * 0.5 - 2);

      _triggerPngDownload(out.toDataURL('image/png'), filename);
      return true;
    }).catch(function (err) {
      console.error('Composite chart PNG export failed:', err);
      return false;
    });
  }

  function downloadStaticPlotPng(srcPath, slug) {
    var cleanSrc = String(srcPath || '').trim();
    if (!/^plots\/[a-zA-Z0-9_.-]+\.(png|webp)$/i.test(cleanSrc)) return false;
    var safeSlug = String(slug || 'process-map').replace(/[^a-zA-Z0-9_-]/gi, '-').toLowerCase();
    var link = document.createElement('a');
    link.href = cleanSrc;
    link.download = 'matsci-' + safeSlug + '.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }

  if (typeof window !== 'undefined') {
    window.downloadDashboardGraph = downloadDashboardGraph;
    window.downloadDashboardGraphGroup = downloadDashboardGraphGroup;
    window.downloadStaticPlotPng = downloadStaticPlotPng;
    window.ChartExporter = {
      downloadDashboardGraph: downloadDashboardGraph,
      downloadDashboardGraphGroup: downloadDashboardGraphGroup,
      downloadStaticPlotPng: downloadStaticPlotPng
    };
  }
})();

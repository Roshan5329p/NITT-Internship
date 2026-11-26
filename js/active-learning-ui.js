/**
 * Active Learning Lab Planner — Peer-Reviewed Proof & Literature Backing UI
 * Reads live synced PAPERS_DATABASE / window.livePapersCatalog records tagged with
 * active_learning_proof / Topic "Active Learning" and renders XSS-safe cards with
 * Scopus citation badges, validated https:// DOI + OA links, and Literature jump actions.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ActiveLearningUi = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function sanitizeHttpUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    try {
      const parsed = new URL(trimmed.startsWith('http://') ? 'https://' + trimmed.slice(7) : trimmed);
      if (parsed.protocol !== 'https:') return '';
      return parsed.toString();
    } catch (_err) {
      return '';
    }
  }

  function getActiveLearningProofPapers() {
    const live = typeof window !== 'undefined' && Array.isArray(window.livePapersCatalog) && window.livePapersCatalog.length > 0
      ? window.livePapersCatalog
      : null;
    const base = typeof PAPERS_DATABASE !== 'undefined' && Array.isArray(PAPERS_DATABASE) ? PAPERS_DATABASE : [];
    const catalog = live || base;

    return catalog.filter((p) => {
      if (!p) return false;
      const top = String(p.topic || '').toLowerCase();
      return Boolean(p.active_learning_proof) || top.includes('active learning');
    });
  }

  function showInLiteratureTable() {
    if (typeof document === 'undefined') return;
    if (typeof switchTab === 'function') {
      switchTab('literature', document.getElementById('navBtnLit'));
    }
    const searchEl = document.getElementById('paperSearchInput');
    if (searchEl) searchEl.value = 'Active Learning';
    if (typeof currentProcessFilter !== 'undefined') currentProcessFilter = 'ALL';
    if (typeof currentTopicFilter !== 'undefined') currentTopicFilter = 'ALL';
    document.querySelectorAll('#view_literature .mp-toggle-btn').forEach((b) => {
      b.classList.toggle('active', b.id === 'btnFilterAll');
    });
    if (typeof filterPapersTable === 'function') {
      filterPapersTable();
    }
  }

  function renderProofCard(containerEl) {
    if (typeof document === 'undefined') return;
    const target = containerEl || document.getElementById('activeLearningProofGrid');
    if (!target) return;

    const papers = getActiveLearningProofPapers();
    const countEl = document.getElementById('activeLearningProofCountBadge');
    if (countEl) {
      countEl.textContent = `${papers.length} Scopus-Verified Papers`;
    }

    if (!papers.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size: 11.5px; color: var(--text-muted); padding: 10px 0;';
      empty.textContent = 'Run scripts/sync_active_learning_papers.mjs to populate verified Active Learning references.';
      target.replaceChildren(empty);
      return;
    }

    const cards = papers.map((p) => {
      const card = document.createElement('article');
      card.className = 'al-proof-item';
      card.style.cssText =
        'background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.22); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;';

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;';

      const authorMeta = document.createElement('div');
      authorMeta.style.cssText = 'font-size: 12px; font-weight: 800; color: #f8fafc;';
      const idStr = p.id ? `${p.id} · ` : '';
      const journalStr = p.journal ? ` · ${p.journal}` : '';
      authorMeta.textContent = `${idStr}${p.author || 'Unknown'}${journalStr}`;

      const badgeGroup = document.createElement('div');
      badgeGroup.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; align-items: center;';

      const citeBadge = document.createElement('span');
      citeBadge.className = 'brand-badge';
      citeBadge.style.cssText = 'font-size: 10px; color: #6ee7b7; background: rgba(16, 185, 129, 0.14); border-color: rgba(16, 185, 129, 0.4);';
      const cites = Number.isFinite(Number(p.citedByCount)) ? Number(p.citedByCount) : null;
      citeBadge.textContent = cites !== null ? `Cited by ${cites}` : (p.treatment || 'Scopus Verified');
      badgeGroup.appendChild(citeBadge);

      if (p.process) {
        const procBadge = document.createElement('span');
        procBadge.className = 'brand-badge';
        procBadge.style.cssText = 'font-size: 10px; color: #7dd3fc; background: rgba(56, 189, 248, 0.12); border-color: rgba(56, 189, 248, 0.35);';
        procBadge.textContent = p.process;
        badgeGroup.appendChild(procBadge);
      }

      topRow.appendChild(authorMeta);
      topRow.appendChild(badgeGroup);
      card.appendChild(topRow);

      if (p.acquisitionMethod) {
        const methodPill = document.createElement('div');
        methodPill.style.cssText = 'font-size: 10.5px; font-family: "JetBrains Mono", monospace; color: #c4b5fd; font-weight: 600;';
        methodPill.textContent = `Method Mapping: ${p.acquisitionMethod}`;
        card.appendChild(methodPill);
      }

      const descEl = document.createElement('div');
      descEl.style.cssText = 'font-size: 11px; color: #cbd5e1; line-height: 1.45;';
      descEl.textContent = p.desc || '';
      card.appendChild(descEl);

      const linksRow = document.createElement('div');
      linksRow.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 4px;';

      const safeDoi = p.doi ? sanitizeHttpUrl(`https://doi.org/${String(p.doi).trim()}`) : '';
      if (safeDoi) {
        const doiA = document.createElement('a');
        doiA.href = safeDoi;
        doiA.target = '_blank';
        doiA.rel = 'noopener noreferrer';
        doiA.style.cssText = 'font-size: 11px; font-family: "JetBrains Mono", monospace; color: #38bdf8; text-decoration: underline;';
        doiA.textContent = `DOI: ${p.doi} ↗`;
        linksRow.appendChild(doiA);
      }

      const safeOa = sanitizeHttpUrl(p.oaUrl);
      if (safeOa) {
        const oaA = document.createElement('a');
        oaA.href = safeOa;
        oaA.target = '_blank';
        oaA.rel = 'noopener noreferrer';
        oaA.style.cssText = 'font-size: 11px; font-family: "JetBrains Mono", monospace; color: #34d399; text-decoration: underline;';
        oaA.textContent = 'OA PDF ↗';
        linksRow.appendChild(oaA);
      }

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'step-btn';
      jumpBtn.style.cssText = 'font-size: 10.5px; padding: 3px 9px; margin-left: auto; color: #bae6fd; border-color: rgba(56, 189, 248, 0.35);';
      jumpBtn.textContent = 'Show in Literature Table →';
      jumpBtn.addEventListener('click', showInLiteratureTable);
      linksRow.appendChild(jumpBtn);

      card.appendChild(linksRow);
      return card;
    });

    target.replaceChildren(...cards);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => renderProofCard());
    } else {
      renderProofCard();
    }
  }

  return {
    sanitizeHttpUrl,
    getActiveLearningProofPapers,
    renderProofCard,
    showInLiteratureTable
  };
});

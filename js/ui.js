/**
 * js/ui.js - OmniSync Data Studio UI Presentation & Interaction Controller
 * Adheres to ui-ux-pro-max (Enterprise Polish, WCAG AAA) and ponytail (Zero-bloat, Native APIs)
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root);
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.UI = factory(root);
    root.UI = root.OmniSync.UI;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  // Format configurations and verified MIME types
  const FORMAT_CONFIG = {
    json: { name: 'JSON', extension: 'json', mime: 'application/json;charset=utf-8' },
    yaml: { name: 'YAML', extension: 'yaml', mime: 'application/x-yaml;charset=utf-8' },
    csv:  { name: 'CSV',  extension: 'csv',  mime: 'text/csv;charset=utf-8' },
    xml:  { name: 'XML',  extension: 'xml',  mime: 'application/xml;charset=utf-8' },
    toml: { name: 'TOML', extension: 'toml', mime: 'application/toml;charset=utf-8' }
  };

  // Inline SVG Vector Icons (Lucide-style, Zero external fonts)
  const ICONS = {
    copy: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
    sun: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
    moon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" x2="3"/></svg>`,
    trash: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  // Internal State
  let undoTimeoutId = null;
  let undoCallback = null;
  let isScrollingSync = false;
  let currentActiveError = null;
  let currentDiffData = null;
  let activeDiffFilter = 'all';

  // Flexible DOM Query Helper
  const $ = (selector, parent = (typeof document !== 'undefined' ? document : null)) => {
    if (!parent) return null;
    return parent.querySelector(selector);
  };
  const $$ = (selector, parent = (typeof document !== 'undefined' ? document : null)) => {
    if (!parent) return [];
    return Array.from(parent.querySelectorAll(selector));
  };

  // HTML Escaping Helper
  function escapeHtml(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Converts 1-based (line, column) coordinates into 0-based character offset.
   * Accurately supports LF (\n) and Windows CRLF (\r\n) line endings.
   */
  function coordinatesToOffset(text, line, column) {
    if (!text || typeof text !== 'string') return 0;
    const len = text.length;
    const targetLine = Math.max(1, line || 1);
    const targetCol = Math.max(1, column || 1);

    let currentLine = 1;
    let i = 0;

    while (i < len && currentLine < targetLine) {
      const ch = text.charCodeAt(i);
      if (ch === 13 /* \r */) {
        if (i + 1 < len && text.charCodeAt(i + 1) === 10 /* \n */) {
          i++; // skip LF in CRLF pair
        }
        currentLine++;
      } else if (ch === 10 /* \n */) {
        currentLine++;
      }
      i++;
    }

    let currentCol = 1;
    while (i < len && currentCol < targetCol) {
      const ch = text.charCodeAt(i);
      if (ch === 10 || ch === 13) break;
      i++;
      currentCol++;
    }

    return Math.min(i, len);
  }

  const UI = {
    $,
    $$,
    ICONS,
    FORMAT_CONFIG,
    coordinatesToOffset,

    /**
     * Initializes theme from localStorage or system preference
     */
    initTheme() {
      if (typeof window === 'undefined') return;
      let theme = 'dark';
      try {
        const savedTheme = localStorage.getItem('omnisync_theme');
        const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        theme = savedTheme || (prefersLight ? 'light' : 'dark');
      } catch (_) {}
      this.setTheme(theme);

      if (typeof window !== 'undefined' && window.matchMedia) {
        try {
          window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
            try {
              if (!localStorage.getItem('omnisync_theme')) {
                this.setTheme(e.matches ? 'light' : 'dark');
              }
            } catch (_) {}
          });
        } catch (_) {}
      }
    },

    /**
     * Sets active theme ('dark' | 'light')
     */
    setTheme(theme) {
      if (typeof document === 'undefined') return;
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('omnisync_theme', theme);
      } catch (_) {}
      const themeBtn = $('#themeToggle') || $('#theme-toggle-btn');
      if (themeBtn) {
        themeBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
        themeBtn.setAttribute('title', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
      }
    },

    /**
     * Toggles between dark and light theme
     */
    toggleTheme() {
      if (typeof document === 'undefined') return;
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      this.setTheme(current === 'dark' ? 'light' : 'dark');
      this.showToast(`Switched to ${current === 'dark' ? 'Crisp Light' : 'Dark OLED'} theme`, 'info');
    },

    /**
     * Non-blocking Toast notification dispatch
     * @param {string} message - Message text
     * @param {'success'|'error'|'info'|'warning'} [type='info'] - Severity type
     * @param {number} [duration=3000] - Auto-dismiss timeout in ms
     */
    showToast(message, type = 'info', duration = 3000) {
      if (typeof document === 'undefined') return;
      let container = $('#toastContainer') || $('#toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-stack';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Notifications');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
      }

      // Max 3 concurrent toasts
      while (container.children.length >= 3) {
        container.removeChild(container.firstChild);
      }

      const toast = document.createElement('div');
      toast.className = `toast-item toast-${type}`;
      toast.setAttribute('role', 'status');
      toast.innerHTML = `
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-dismiss" aria-label="Dismiss notification">${ICONS.close}</button>
      `;

      const removeToast = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 180);
      };

      const dismissBtn = toast.querySelector('.toast-dismiss');
      if (dismissBtn) dismissBtn.addEventListener('click', removeToast);

      container.appendChild(toast);

      if (duration > 0) {
        setTimeout(removeToast, duration);
      }
    },

    /**
     * Soft clear with 5-second countdown Undo Snackbar
     * @param {Function} onUndo - Callback executed if user hits Undo
     * @param {number} [durationMs=5000] - Snackbar lifetime
     */
    showUndoSnackbar(onUndo, durationMs = 5000) {
      if (typeof document === 'undefined') return;
      const snackbar = $('#undoSnackbar') || $('#undo-snackbar');
      if (!snackbar) return;

      this.clearUndoSnackbar();
      undoCallback = onUndo;

      snackbar.classList.remove('hidden');

      const progressBar = $('#undoProgressBar') || $('#undo-progress-bar');
      if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '100%';
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            progressBar.style.transition = `width ${durationMs}ms linear`;
            progressBar.style.width = '0%';
          });
        }
      }

      undoTimeoutId = setTimeout(() => {
        this.clearUndoSnackbar();
      }, durationMs);
    },

    /**
     * Clears and hides active Undo snackbar
     */
    clearUndoSnackbar() {
      if (undoTimeoutId) {
        clearTimeout(undoTimeoutId);
        undoTimeoutId = null;
      }
      undoCallback = null;
      const snackbar = $('#undoSnackbar') || $('#undo-snackbar');
      if (snackbar) {
        snackbar.classList.add('hidden');
      }
    },

    /**
     * Executes undo action if snackbar is currently visible
     */
    triggerUndo() {
      if (typeof undoCallback === 'function') {
        const cb = undoCallback;
        this.clearUndoSnackbar();
        cb();
        this.showToast('Restored previous editor content', 'success');
        return true;
      }
      return false;
    },

    /**
     * Clipboard quick copy with checkmark state toggle (2s) and fallback
     */
    async copyToClipboard(text, triggerButton) {
      if (!text || !text.trim()) {
        this.showToast('Nothing to copy: editor is empty', 'warning');
        return false;
      }

      let success = false;
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && (typeof window === 'undefined' || window.isSecureContext)) {
          await navigator.clipboard.writeText(text);
          success = true;
        } else if (typeof document !== 'undefined') {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          success = document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      } catch (e) {
        success = false;
      }

      if (success) {
        if (triggerButton) {
          const originalContent = triggerButton.innerHTML;
          triggerButton.innerHTML = `${ICONS.check} <span>Copied!</span>`;
          triggerButton.classList.add('btn-copied');
          setTimeout(() => {
            triggerButton.innerHTML = originalContent;
            triggerButton.classList.remove('btn-copied');
          }, 2000);
        }
        let bytes = 0;
        try {
          bytes = (typeof Blob !== 'undefined') ? new Blob([text]).size : text.length;
        } catch (_) {
          bytes = text.length;
        }
        this.showToast(`Copied ${bytes} bytes to clipboard`, 'success');
        return true;
      } else {
        this.showToast('Failed to copy to clipboard', 'error');
        return false;
      }
    },

    /**
     * Downloads content with verified MIME type and auto-named timestamp
     */
    downloadFile(filename, content, mimeType) {
      if (!content || !content.trim()) {
        this.showToast('Cannot export: editor is empty', 'warning');
        return;
      }

      try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.showToast(`Exported as ${filename}`, 'info');
      } catch (err) {
        this.showToast(`Export failed: ${err.message}`, 'error');
      }
    },

    /**
     * Generates standard timestamped filename
     */
    getTimestampedFilename(format) {
      const cfg = FORMAT_CONFIG[format.toLowerCase()] || { extension: 'txt' };
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      return `omnisync_${format.toLowerCase()}_${timestamp}.${cfg.extension}`;
    },

    /**
     * Synchronized proportional scrolling between two elements
     */
    syncScroll(sourceEl, targetEl) {
      if (isScrollingSync || !sourceEl || !targetEl) return;
      isScrollingSync = true;

      const maxScrollSource = sourceEl.scrollHeight - sourceEl.clientHeight;
      const maxScrollTarget = targetEl.scrollHeight - targetEl.clientHeight;

      if (maxScrollSource > 0 && maxScrollTarget > 0) {
        const percentage = sourceEl.scrollTop / maxScrollSource;
        targetEl.scrollTop = percentage * maxScrollTarget;
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          isScrollingSync = false;
        });
      } else {
        isScrollingSync = false;
      }
    },

    /**
     * Updates line numbers in custom gutter
     */
    updateGutter(pane) {
      const editor = $(`#${pane}Editor`) || $(`#${pane}-editor`);
      const gutter = $(`#${pane}Gutter`) || $(`#${pane}-gutter`);
      if (!editor || !gutter) return;

      const lineCount = (editor.value.match(/\n/g) || []).length + 1;
      if (gutter._lastLineCount === lineCount) {
        gutter.scrollTop = editor.scrollTop;
        return;
      }
      gutter._lastLineCount = lineCount;

      let numbers = '';
      for (let i = 1; i <= lineCount; i++) {
        numbers += `<div class="gutter-num">${i}</div>`;
      }
      gutter.innerHTML = numbers;
      gutter.scrollTop = editor.scrollTop;
    },

    /**
     * Updates document metrics pill
     */
    updateMetrics(pane, text) {
      const statsPill = $(`#${pane}Stats`) || $(`#${pane}-stats`);
      if (!statsPill) return;

      if (!text || !text.trim()) {
        statsPill.textContent = '0 bytes | 0 lines';
        return;
      }

      const lines = (text.match(/\n/g) || []).length + 1;
      let bytes = text.length;
      try {
        bytes = (typeof Blob !== 'undefined') ? new Blob([text]).size : text.length;
      } catch (_) {}
      const formattedBytes = bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`;
      statsPill.textContent = `${formattedBytes} | ${lines} lines`;
    },

    /**
     * Updates live status badge
     */
    setStatus(status, durationMs) {
      const badge = $('#statusBadge') || $('#sync-status-badge');
      const latency = $('#latencyPill') || $('#sync-latency');
      const statusText = $('#statusText');
      const msg = $('#statusBarMessage') || $('#status-bar-message');
      if (!badge) return;

      badge.className = 'status-badge';
      const normStatus = (status || 'idle').toLowerCase();

      switch (normStatus) {
        case 'synced':
          badge.classList.add('status-synced');
          if (statusText) statusText.textContent = 'Synced';
          if (latency && durationMs !== undefined) {
            latency.textContent = `${durationMs.toFixed(1)} ms`;
          }
          if (msg) msg.textContent = 'Data synchronized successfully.';
          break;
        case 'converting':
        case 'syncing':
          badge.classList.add('status-syncing');
          if (statusText) statusText.textContent = 'Converting...';
          if (msg) msg.textContent = 'Translating data structures...';
          break;
        case 'validating':
          badge.classList.add('status-syncing');
          if (statusText) statusText.textContent = 'Validating...';
          if (msg) msg.textContent = 'Validating syntax and intermediate model...';
          break;
        case 'editing':
        case 'stale':
          badge.classList.add('status-stale');
          if (statusText) statusText.textContent = 'Editing...';
          if (msg) msg.textContent = 'Editing in progress...';
          break;
        case 'error':
          badge.classList.add('status-error');
          if (statusText) statusText.textContent = 'Syntax Error';
          if (msg) msg.textContent = 'Syntax error in document.';
          break;
        case 'idle':
        default:
          badge.classList.add('status-idle');
          if (statusText) statusText.textContent = 'Idle';
          if (latency) latency.textContent = '0.0 ms';
          if (msg) msg.textContent = 'Ready.';
          break;
      }
    },

    /**
     * Shows error banner with clickable jump-to-line anchor and caret snippet
     */
    showErrorBanner(pane, error) {
      const banner = $('#errorBanner') || $(`#${pane}-error-banner`) || $(`#${pane}ErrorBanner`);
      if (!banner) return;

      const line = (error && error.line) || 1;
      const col = (error && error.column) || 1;
      const message = (error && error.message) || 'Syntax error';
      const snippet = (error && error.snippet) || '';

      currentActiveError = { pane, line, col, message, snippet };

      // Update contents
      const msgEl = $('#errorMessageText') || banner.querySelector('.banner-message');
      if (msgEl) msgEl.textContent = message;

      const coordsEl = $('#errorCoordsText');
      if (coordsEl) coordsEl.textContent = `Line ${line}, Column ${col}`;

      const paneBadge = $('#errorPaneBadge');
      if (paneBadge) {
        paneBadge.textContent = pane === 'left' ? 'Source Editor' : 'Target Editor';
      }

      const snippetEl = $('#errorCodeFrameSnippet');
      if (snippetEl) {
        snippetEl.textContent = snippet;
      }

      const jumpBtn = $('#errorJumpBtn');
      if (jumpBtn) {
        jumpBtn.setAttribute('aria-label', `Jump to Line ${line}, Column ${col} in editor`);
      }

      banner.classList.remove('hidden');
    },

    /**
     * Clears and hides error banner
     */
    clearErrorBanner(pane) {
      const banner = $('#errorBanner') || $(`#${pane}-error-banner`) || $(`#${pane}ErrorBanner`);
      if (banner) {
        banner.classList.add('hidden');
      }
      currentActiveError = null;
    },

    /**
     * Gets current active error
     */
    getActiveError() {
      return currentActiveError;
    },

    /**
     * Scrolls textarea to line, sets caret range, and centers line in viewport
     */
    jumpToLine(pane, targetLine, targetCol, highlightLen = 1) {
      const editor = $(`#${pane}Editor`) || $(`#${pane}-editor`);
      if (!editor) return;

      editor.focus();
      const text = editor.value || '';
      const offset = coordinatesToOffset(text, targetLine, targetCol);
      const endOffset = Math.min(offset + highlightLen, text.length);

      if (typeof editor.setSelectionRange === 'function') {
        editor.setSelectionRange(offset, endOffset);
      }

      // Smooth Viewport Centering
      let lineHeight = 20;
      let paddingTop = 8;
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        const style = window.getComputedStyle(editor);
        const lh = parseFloat(style.lineHeight);
        if (!isNaN(lh) && lh > 0) lineHeight = lh;
        const pt = parseFloat(style.paddingTop);
        if (!isNaN(pt)) paddingTop = pt;
      }

      const clientHeight = editor.clientHeight || 400;
      const targetY = (targetLine - 1) * lineHeight + paddingTop;
      const centeredScroll = Math.max(0, targetY - (clientHeight / 2));

      if (typeof editor.scrollTo === 'function') {
        editor.scrollTo({ top: centeredScroll, behavior: 'smooth' });
      } else {
        editor.scrollTop = centeredScroll;
      }

      // Border glow pulse
      const container = editor.closest('.editor-pane') || editor;
      container.classList.add('editor-error-pulse');
      setTimeout(() => {
        container.classList.remove('editor-error-pulse');
      }, 1500);
    },

    /**
     * Handles Tab indentation in textarea
     */
    handleTabIndent(e) {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      textarea.value = val.substring(0, start) + '  ' + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    },

    /**
     * Updates diff summary indicator
     */
    updateDiffSummary(diff) {
      currentDiffData = diff;
      const diffSummaryText = $('#diffSummaryText');
      const diffSummaryPill = $('#diffSummaryPill');
      const badge = $('#diffModalSummaryBadge');

      if (!diff) return;

      const summaryStr = diff.summary || '0 changes';
      if (diffSummaryText) diffSummaryText.textContent = `Diff (${summaryStr})`;
      if (diffSummaryPill) diffSummaryPill.setAttribute('title', summaryStr);
      if (badge) badge.textContent = summaryStr;

      // Update counters
      const patches = (diff && diff.patches) || [];
      const addCount = patches.filter(p => p.op === 'add').length;
      const removeCount = patches.filter(p => p.op === 'remove').length;
      const replaceCount = patches.filter(p => p.op === 'replace').length;

      const cAll = $('#diffCountAll');
      const cAdd = $('#diffCountAdd');
      const cRemove = $('#diffCountRemove');
      const cReplace = $('#diffCountReplace');

      if (cAll) cAll.textContent = patches.length;
      if (cAdd) cAdd.textContent = addCount;
      if (cRemove) cRemove.textContent = removeCount;
      if (cReplace) cReplace.textContent = replaceCount;
    },

    /**
     * Opens Diff Visualizer Modal
     */
    showDiffModal(diff) {
      if (diff) this.updateDiffSummary(diff);
      const modal = $('#diffModal');
      if (!modal) return;
      modal.classList.remove('hidden');
      this.renderDiffCards(currentDiffData, activeDiffFilter);
      this.renderRawDiffJson(currentDiffData);
    },

    /**
     * Closes Diff Visualizer Modal
     */
    hideDiffModal() {
      const modal = $('#diffModal');
      if (modal) modal.classList.add('hidden');
    },

    /**
     * Sets active filter tab for Diff cards ('all' | 'add' | 'remove' | 'replace')
     */
    setDiffFilter(filter) {
      activeDiffFilter = filter;
      $$('.diff-tab').forEach(tab => {
        const matches = tab.getAttribute('data-filter') === filter;
        tab.classList.toggle('active', matches);
        tab.setAttribute('aria-selected', matches ? 'true' : 'false');
      });
      this.renderDiffCards(currentDiffData, activeDiffFilter);
    },

    /**
     * Renders Diff patch cards into #diffPatchCardList
     */
    renderDiffCards(diff, filter = 'all') {
      const container = $('#diffPatchCardList');
      if (!container) return;

      container.innerHTML = '';
      const patches = (diff && diff.patches) || [];

      if (patches.length === 0) {
        container.innerHTML = `
          <div class="diff-empty-state">
            <svg class="icon-hero" aria-hidden="true"><use href="#icon-check"></use></svg>
            <h3>Datasets are Structurally Identical</h3>
            <p>Zero RFC 6902 patch operations detected between left and right data states.</p>
          </div>
        `;
        return;
      }

      const filtered = patches.filter(p => (filter === 'all' ? true : p.op === filter));

      if (filtered.length === 0) {
        container.innerHTML = `<div class="diff-empty-state"><p>No patch operations match filter "${escapeHtml(filter)}".</p></div>`;
        return;
      }

      filtered.forEach((patch, idx) => {
        const card = document.createElement('div');
        card.className = `diff-patch-item op-${patch.op}`;

        let opBadge = '';
        let valueHtml = '';

        if (patch.op === 'add') {
          opBadge = `<span class="badge badge-version">+ ADD</span>`;
          valueHtml = `
            <div class="diff-val-box">
              <pre><code>${escapeHtml(JSON.stringify(patch.value, null, 2))}</code></pre>
            </div>
          `;
        } else if (patch.op === 'remove') {
          opBadge = `<span class="badge" style="background:var(--color-danger-bg);color:var(--color-danger);">- REMOVE</span>`;
          valueHtml = `
            <div class="diff-val-box">
              <pre><code>${escapeHtml(JSON.stringify(patch.oldValue !== undefined ? patch.oldValue : '(element)', null, 2))}</code></pre>
            </div>
          `;
        } else if (patch.op === 'replace') {
          opBadge = `<span class="badge" style="background:var(--color-warning-bg);color:var(--color-warning);">~ REPLACE</span>`;
          valueHtml = `
            <div class="diff-replace-grid">
              <div class="diff-val-box" style="flex:1;">
                <pre><code>${escapeHtml(JSON.stringify(patch.oldValue, null, 2))}</code></pre>
              </div>
              <div class="diff-arrow-separator">→</div>
              <div class="diff-val-box" style="flex:1;">
                <pre><code>${escapeHtml(JSON.stringify(patch.value, null, 2))}</code></pre>
              </div>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="patch-header">
            <div class="patch-op-group">
              ${opBadge}
              <code class="patch-pointer-path">${escapeHtml(patch.path)}</code>
            </div>
            <span class="patch-index">#${idx + 1}</span>
          </div>
          <div class="patch-body">
            ${valueHtml}
          </div>
        `;

        container.appendChild(card);
      });
    },

    /**
     * Renders raw RFC 6902 JSON array in #diffRawJsonBlock
     */
    renderRawDiffJson(diff) {
      const codeBlock = $('#diffRawJsonBlock');
      if (!codeBlock) return;
      const patches = (diff && diff.patches) || [];
      codeBlock.textContent = JSON.stringify(patches, null, 2);
    },

    /**
     * Toggles between Cards view and Raw Patch view in Diff modal
     */
    setDiffViewMode(mode) {
      const cardList = $('#diffPatchCardList');
      const rawView = $('#diffPatchRawView');
      const btnCards = $('#diffViewCardsBtn');
      const btnRaw = $('#diffViewRawBtn');

      if (mode === 'raw') {
        if (cardList) cardList.classList.add('hidden');
        if (rawView) rawView.classList.remove('hidden');
        if (btnCards) btnCards.classList.remove('active');
        if (btnRaw) btnRaw.classList.add('active');
        this.renderRawDiffJson(currentDiffData);
      } else {
        if (cardList) cardList.classList.remove('hidden');
        if (rawView) rawView.classList.add('hidden');
        if (btnCards) btnCards.classList.add('active');
        if (btnRaw) btnRaw.classList.remove('active');
        this.renderDiffCards(currentDiffData, activeDiffFilter);
      }
    },

    /**
     * Shows Shortcuts Dialog
     */
    showShortcutsModal() {
      const modal = $('#shortcutsModal');
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
      }
    },

    /**
     * Hides Shortcuts Dialog
     */
    hideShortcutsModal() {
      const modal = $('#shortcutsModal');
      if (modal) {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          modal.removeAttribute('open');
        }
      }
    }
  };

  return UI;
});

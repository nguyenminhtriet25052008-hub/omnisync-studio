/**
 * js/app.js - OmniSync Data Studio Main Application Controller
 * Coordinates SyncEngine, DOM events, format changes, sample datasets, and shortcuts
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root);
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.App = factory(root);
    root.App = root.OmniSync.App;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  const UI = (root && root.OmniSync && root.OmniSync.UI) || (root && root.UI);
  const SyncEngine = (root && root.OmniSync && root.OmniSync.SyncEngine) || (root && root.SyncEngine);

  // 4 Production-Grade Sample Datasets Presets
  const SAMPLE_PRESETS = {
    sensor_metrics: {
      name: 'IoT Sensor Fleet Telemetry (JSON ⇄ YAML)',
      recommendedFrom: 'json',
      recommendedTo: 'yaml',
      data: `{
  "fleet_id": "VN-CAMAU-SENSORS",
  "generated_at": "2026-11-05T09:40:00Z",
  "readings": [
    {
      "sensor_id": "TEMP-001",
      "metric": "temperature_celsius",
      "value": 28.4,
      "location": { "lat": 9.1768, "lon": 105.1500 },
      "status": "NORMAL"
    },
    {
      "sensor_id": "HUM-002",
      "metric": "humidity_percent",
      "value": 78.2,
      "location": { "lat": 9.1768, "lon": 105.1500 },
      "status": "WARNING"
    }
  ]
}`
    },
    users_table: {
      name: 'Users & Roles Table (CSV ⇄ JSON)',
      recommendedFrom: 'csv',
      recommendedTo: 'json',
      data: `id,name,role,department,salary,active,skills
101,Nguyen Minh Triet,Lead Architect,Engineering,95000,true,JavaScript;Rust;Python
102,Elena Rostova,Systems Designer,Infrastructure,92000,true,Linux;Docker;K8s
103,Marcus Vance,Data Engineer,Analytics,88000,false,SQL;Spark;Parquet
104,Sarah Jenkins,Security Analyst,SecOps,91000,true,Cryptography;Audit;Go`
    },
    cloud_config: {
      name: 'Cloud Infrastructure Config (YAML ⇄ TOML)',
      recommendedFrom: 'yaml',
      recommendedTo: 'toml',
      data: `server:
  host: 0.0.0.0
  port: 8080
  workers: 4
  tls:
    enabled: true
    cert_path: /etc/ssl/certs/omnisync.pem
database:
  engine: postgresql
  pool_size: 20
  timeout_seconds: 5.5
features:
  auto_sync: true
  metrics_enabled: true
  allowed_origins:
    - https://omnisync.studio
    - http://localhost:3000`
    },
    university_catalog: {
      name: 'University Academic Catalog (XML ⇄ JSON)',
      recommendedFrom: 'xml',
      recommendedTo: 'json',
      data: `<university name="HCMUT">
  <faculty id="EE" name="Electrical &amp; Electronic Engineering">
    <dean>Prof. Nguyen Van A</dean>
    <course code="EE101" credits="4">
      <title>Circuit Theory</title>
      <prerequisite>MATH101</prerequisite>
      <prerequisite>PHYS101</prerequisite>
    </course>
    <course code="EE202" credits="3">
      <title>Signals and Systems</title>
      <prerequisite>EE101</prerequisite>
    </course>
  </faculty>
</university>`
    }
  };

  const App = {
    syncEngine: null,
    autoSync: true,
    syncScroll: true,
    lastActivePane: 'left',
    currentDiff: null,

    /**
     * Bootstraps the application on DOM ready
     */
    init() {
      if (typeof document === 'undefined') return;

      // 1. Initialize Theme
      if (UI && typeof UI.initTheme === 'function') {
        UI.initTheme();
      }

      // 2. Instantiate SyncEngine
      this.initEngine();

      // 3. Attach DOM Event Listeners
      this.bindControls();
      this.bindEditors();
      this.bindDragDrop();
      this.bindShortcuts();
      this.bindDiffModal();

      // 4. Load initial default sample
      this.loadSample('sensor_metrics');

      if (UI && typeof UI.setStatus === 'function') {
        UI.setStatus('idle');
      }
    },

    initEngine() {
      const self = this;
      if (!SyncEngine) return;

      this.syncEngine = new SyncEngine({
        debounceMs: 250,
        onSync(evt) {
          const targetEditor = UI.$(`#${evt.targetPane}Editor`) || UI.$(`#${evt.targetPane}-editor`);
          if (targetEditor) {
            targetEditor.value = evt.text;
            UI.updateGutter(evt.targetPane);
            UI.updateMetrics(evt.targetPane, evt.text);
          }
          UI.clearErrorBanner(evt.targetPane);
          UI.clearErrorBanner(evt.sourcePane);
          UI.setStatus('synced', evt.durationMs);
          if (evt.diff) {
            self.currentDiff = evt.diff;
            UI.updateDiffSummary(evt.diff);
          }
        },
        onError(evt) {
          UI.showErrorBanner(evt.sourcePane, evt.error);
          UI.setStatus('error');
        },
        onStatusChange(status) {
          UI.setStatus(status);
        }
      });
    },

    bindControls() {
      const self = this;

      // Theme toggle
      const themeBtn = UI.$('#themeToggle') || UI.$('#theme-toggle-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => UI.toggleTheme());
      }

      // Format changes
      const leftFmt = UI.$('#leftFormat') || UI.$('#left-format-select');
      const rightFmt = UI.$('#rightFormat') || UI.$('#right-format-select');

      if (leftFmt) {
        leftFmt.addEventListener('change', () => {
          self.handleFormatChange('left');
        });
      }
      if (rightFmt) {
        rightFmt.addEventListener('change', () => {
          self.handleFormatChange('right');
        });
      }

      // Swap Direction (Alt+S)
      const swapBtn = UI.$('#swapBtn') || UI.$('#swap-direction-btn');
      if (swapBtn) {
        swapBtn.addEventListener('click', () => self.swapDirection());
      }

      // Center manual sync trigger
      const centerSyncBtn = UI.$('#btnCenterSync') || UI.$('#manual-sync-btn');
      if (centerSyncBtn) {
        centerSyncBtn.addEventListener('click', () => self.triggerManualSync());
      }

      // Auto-Sync Toggle
      const autoSyncCheck = UI.$('#autoSyncToggle') || UI.$('#chkAutoSync') || UI.$('#auto-sync-toggle');
      if (autoSyncCheck) {
        autoSyncCheck.addEventListener('change', (e) => {
          self.autoSync = e.target.checked;
          UI.showToast(`Auto-sync ${self.autoSync ? 'enabled' : 'disabled'}`, 'info');
        });
      }

      // Synchronized Scroll Toggle
      const syncScrollCheck = UI.$('#syncScrollToggle') || UI.$('#chkSyncScroll') || UI.$('#sync-scroll-toggle');
      if (syncScrollCheck) {
        syncScrollCheck.addEventListener('change', (e) => {
          self.syncScroll = e.target.checked;
          UI.showToast(`Synchronized scrolling ${self.syncScroll ? 'enabled' : 'disabled'}`, 'info');
        });
      }

      // Sample Preset Selector
      const presetSelect = UI.$('#presetSelect') || UI.$('#preset-select');
      if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            self.loadSample(e.target.value);
            e.target.value = ''; // Reset select to allow re-selection
          }
        });
      }

      // Undo Snackbar Button
      const undoBtn = UI.$('#undoSnackbarBtn') || UI.$('#btnUndoAction') || UI.$('#undo-snackbar-btn');
      if (undoBtn) {
        undoBtn.addEventListener('click', () => UI.triggerUndo());
      }

      const dismissUndoBtn = UI.$('#btnDismissUndo');
      if (dismissUndoBtn) {
        dismissUndoBtn.addEventListener('click', () => UI.clearUndoSnackbar());
      }

      // Diagnostic Jump and Dismiss Buttons
      const jumpBtn = UI.$('#errorJumpBtn');
      if (jumpBtn) {
        jumpBtn.addEventListener('click', () => {
          const err = UI.getActiveError();
          if (err) {
            UI.jumpToLine(err.pane, err.line, err.col);
          }
        });
      }

      const dismissErrBtn = UI.$('#errorDismissBtn');
      if (dismissErrBtn) {
        dismissErrBtn.addEventListener('click', () => {
          UI.clearErrorBanner('left');
          UI.clearErrorBanner('right');
        });
      }

      // Shortcuts Modal Triggers
      const shortcutsBtn = UI.$('#shortcutsBtn') || UI.$('#btnShortcutsHelp');
      if (shortcutsBtn) {
        shortcutsBtn.addEventListener('click', () => UI.showShortcutsModal());
      }
      const closeShortcutsBtn = UI.$('#btnCloseShortcuts');
      if (closeShortcutsBtn) {
        closeShortcutsBtn.addEventListener('click', () => UI.hideShortcutsModal());
      }

      // Mobile Tab Buttons
      const tabLeft = UI.$('#tabLeftPane');
      const tabRight = UI.$('#tabRightPane');
      const leftPane = UI.$('#leftPane');
      const rightPane = UI.$('#rightPane');

      if (tabLeft && tabRight && leftPane && rightPane) {
        tabLeft.addEventListener('click', () => {
          tabLeft.classList.add('active');
          tabLeft.setAttribute('aria-selected', 'true');
          tabRight.classList.remove('active');
          tabRight.setAttribute('aria-selected', 'false');
          leftPane.classList.add('active-tab');
          rightPane.classList.remove('active-tab');
        });

        tabRight.addEventListener('click', () => {
          tabRight.classList.add('active');
          tabRight.setAttribute('aria-selected', 'true');
          tabLeft.classList.remove('active');
          tabLeft.setAttribute('aria-selected', 'false');
          rightPane.classList.add('active-tab');
          leftPane.classList.remove('active-tab');
        });
      }

      // Pane Action Buttons (Copy, Clear, Download, Prettify)
      ['left', 'right'].forEach((pane) => {
        // Copy
        const copyBtn = UI.$(`#${pane}CopyBtn`) || UI.$(`#${pane}-copy-btn`) || UI.$(`#btn${pane.charAt(0).toUpperCase() + pane.slice(1)}Copy`);
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            const editor = UI.$(`#${pane}Editor`) || UI.$(`#${pane}-editor`);
            if (editor) UI.copyToClipboard(editor.value, copyBtn);
          });
        }

        // Clear with 5-Second Undo
        const clearBtn = UI.$(`#${pane}ClearBtn`) || UI.$(`#${pane}-clear-btn`) || UI.$(`#btn${pane.charAt(0).toUpperCase() + pane.slice(1)}Clear`);
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            self.clearPaneWithUndo(pane);
          });
        }

        // Download
        const downloadBtn = UI.$(`#${pane}DownloadBtn`) || UI.$(`#${pane}-download-btn`) || UI.$(`#btn${pane.charAt(0).toUpperCase() + pane.slice(1)}Download`);
        if (downloadBtn) {
          downloadBtn.addEventListener('click', () => {
            const editor = UI.$(`#${pane}Editor`) || UI.$(`#${pane}-editor`);
            const fmtEl = UI.$(`#${pane}Format`) || UI.$(`#${pane}-format-select`);
            const fmt = (fmtEl && fmtEl.value) || 'json';
            const filename = UI.getTimestampedFilename(fmt);
            const mime = (UI.FORMAT_CONFIG[fmt.toLowerCase()] || {}).mime || 'text/plain';
            if (editor) UI.downloadFile(filename, editor.value, mime);
          });
        }

        // Format / Prettify
        const formatBtn = UI.$(`#${pane}PrettifyBtn`) || UI.$(`#btn${pane.charAt(0).toUpperCase() + pane.slice(1)}Prettify`) || UI.$(`#${pane}-format-btn`);
        if (formatBtn) {
          formatBtn.addEventListener('click', () => {
            self.prettifyPane(pane);
          });
        }

        // Upload Button & Hidden File Input
        const uploadBtn = UI.$(`#${pane}UploadBtn`) || UI.$(`#btn${pane.charAt(0).toUpperCase() + pane.slice(1)}Upload`);
        const fileInput = UI.$(`#${pane}FileInput`) || UI.$(`#fileInput${pane.charAt(0).toUpperCase() + pane.slice(1)}`);
        if (uploadBtn && fileInput) {
          uploadBtn.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
              self.loadFileIntoPane(pane, e.target.files[0]);
              fileInput.value = '';
            }
          });
        }
      });
    },

    bindEditors() {
      const self = this;
      const leftEditor = UI.$('#leftEditor') || UI.$('#left-editor');
      const rightEditor = UI.$('#rightEditor') || UI.$('#right-editor');

      if (leftEditor) {
        leftEditor.addEventListener('input', () => {
          self.lastActivePane = 'left';
          UI.updateGutter('left');
          UI.updateMetrics('left', leftEditor.value);
          if (self.autoSync && self.syncEngine) {
            const leftFmt = (UI.$('#leftFormat') || UI.$('#left-format-select')).value;
            const rightFmt = (UI.$('#rightFormat') || UI.$('#right-format-select')).value;
            self.syncEngine.handleInput('left', leftEditor.value, leftFmt, rightFmt);
          } else {
            UI.setStatus('stale');
          }
        });

        leftEditor.addEventListener('scroll', () => {
          UI.updateGutter('left');
          if (self.syncScroll && rightEditor) {
            UI.syncScroll(leftEditor, rightEditor);
          }
        });

        leftEditor.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') UI.handleTabIndent(e);
        });
      }

      if (rightEditor) {
        rightEditor.addEventListener('input', () => {
          self.lastActivePane = 'right';
          UI.updateGutter('right');
          UI.updateMetrics('right', rightEditor.value);
          if (self.autoSync && self.syncEngine) {
            const leftFmt = (UI.$('#leftFormat') || UI.$('#left-format-select')).value;
            const rightFmt = (UI.$('#rightFormat') || UI.$('#right-format-select')).value;
            self.syncEngine.handleInput('right', rightEditor.value, rightFmt, leftFmt);
          } else {
            UI.setStatus('stale');
          }
        });

        rightEditor.addEventListener('scroll', () => {
          UI.updateGutter('right');
          if (self.syncScroll && leftEditor) {
            UI.syncScroll(rightEditor, leftEditor);
          }
        });

        rightEditor.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') UI.handleTabIndent(e);
        });
      }
    },

    bindDragDrop() {
      const self = this;
      ['left', 'right'].forEach((pane) => {
        const dropzone = UI.$(`#${pane}Dropzone`) || UI.$(`#${pane}DragOverlay`) || UI.$(`#${pane}-dropzone`);
        const editor = UI.$(`#${pane}Editor`) || UI.$(`#${pane}-editor`);
        const target = dropzone || editor;
        if (!target) return;

        ['dragenter', 'dragover'].forEach((evtName) => {
          target.addEventListener(evtName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropzone) dropzone.classList.add('active');
          });
        });

        ['dragleave', 'drop'].forEach((evtName) => {
          target.addEventListener(evtName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dropzone) dropzone.classList.remove('active');
          });
        });

        target.addEventListener('drop', (e) => {
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            self.loadFileIntoPane(pane, e.dataTransfer.files[0]);
          }
        });
      });
    },

    bindShortcuts() {
      const self = this;
      window.addEventListener('keydown', (e) => {
        // Ctrl+Enter / Cmd+Enter: Manual sync
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          self.triggerManualSync();
        }
        // Alt+S: Direction swap
        else if (e.altKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          self.swapDirection();
        }
        // Ctrl+Shift+C: Quick Copy target output
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
          e.preventDefault();
          const targetPane = self.lastActivePane === 'left' ? 'right' : 'left';
          const targetEditor = UI.$(`#${targetPane}Editor`) || UI.$(`#${targetPane}-editor`);
          const targetBtn = UI.$(`#${targetPane}CopyBtn`) || UI.$(`#${targetPane}-copy-btn`);
          if (targetEditor) UI.copyToClipboard(targetEditor.value, targetBtn);
        }
        // Ctrl+Shift+F: Prettify active editor
        else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
          e.preventDefault();
          self.prettifyPane(self.lastActivePane);
        }
        // Ctrl+Z: Undo soft clear if snackbar is active
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
          if (UI.triggerUndo()) {
            e.preventDefault();
          }
        }
        // Escape: Dismiss overlays & banners
        else if (e.key === 'Escape') {
          UI.clearUndoSnackbar();
          UI.clearErrorBanner('left');
          UI.clearErrorBanner('right');
          UI.hideDiffModal();
          UI.hideShortcutsModal();
        }
        // F1 or Shift+?: Open Shortcuts Dialog
        else if (e.key === 'F1' || (e.shiftKey && e.key === '?')) {
          e.preventDefault();
          UI.showShortcutsModal();
        }
      });
    },

    bindDiffModal() {
      const self = this;
      const diffTrigger = UI.$('#diffSummaryPill') || UI.$('#btnToggleDiff');
      if (diffTrigger) {
        diffTrigger.addEventListener('click', () => {
          UI.showDiffModal(self.currentDiff);
        });
      }

      const closeBtn = UI.$('#diffModalCloseBtn') || UI.$('#btnCloseDiff');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => UI.hideDiffModal());
      }

      const dismissBtn = UI.$('#diffModalDismissBtn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => UI.hideDiffModal());
      }

      // Filter tabs
      UI.$$('.diff-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const filter = tab.getAttribute('data-filter') || 'all';
          UI.setDiffFilter(filter);
        });
      });

      // View mode buttons
      const btnCards = UI.$('#diffViewCardsBtn');
      const btnRaw = UI.$('#diffViewRawBtn');
      if (btnCards) {
        btnCards.addEventListener('click', () => UI.setDiffViewMode('cards'));
      }
      if (btnRaw) {
        btnRaw.addEventListener('click', () => UI.setDiffViewMode('raw'));
      }

      // Copy patch button
      const copyPatchBtn = UI.$('#diffCopyPatchBtn');
      if (copyPatchBtn) {
        copyPatchBtn.addEventListener('click', () => {
          const codeBlock = UI.$('#diffRawJsonBlock');
          if (codeBlock) {
            UI.copyToClipboard(codeBlock.textContent, copyPatchBtn);
          }
        });
      }
    },

    handleFormatChange(changedPane) {
      const leftFmt = (UI.$('#leftFormat') || UI.$('#left-format-select')).value;
      const rightFmt = (UI.$('#rightFormat') || UI.$('#right-format-select')).value;
      const leftEditor = UI.$('#leftEditor') || UI.$('#left-editor');
      const rightEditor = UI.$('#rightEditor') || UI.$('#right-editor');

      // Update mobile format labels
      const mLeft = UI.$('#mobileLeftFormatLabel');
      const mRight = UI.$('#mobileRightFormatLabel');
      if (mLeft) mLeft.textContent = leftFmt.toUpperCase();
      if (mRight) mRight.textContent = rightFmt.toUpperCase();

      if (!this.syncEngine) return;

      this.syncEngine.cancelPending();

      if (changedPane === 'right') {
        // Re-convert left to new right format
        if (leftEditor && leftEditor.value.trim()) {
          const res = this.syncEngine.convertImmediate(leftEditor.value, leftFmt, rightFmt);
          if (res.success) {
            if (rightEditor) {
              rightEditor.value = res.result;
              UI.updateGutter('right');
              UI.updateMetrics('right', rightEditor.value);
            }
            UI.clearErrorBanner('left');
            UI.setStatus('synced');
            UI.showToast(`Converted to ${rightFmt.toUpperCase()}`, 'info');
          } else {
            UI.showErrorBanner('left', res.error);
            UI.setStatus('error');
          }
        }
      } else {
        // Left format changed
        if (this.lastActivePane === 'left' && leftEditor && leftEditor.value.trim()) {
          const res = this.syncEngine.convertImmediate(leftEditor.value, leftFmt, rightFmt);
          if (res.success) {
            if (rightEditor) {
              rightEditor.value = res.result;
              UI.updateGutter('right');
              UI.updateMetrics('right', rightEditor.value);
            }
            UI.clearErrorBanner('left');
            UI.setStatus('synced');
            UI.showToast(`Converted to ${rightFmt.toUpperCase()}`, 'info');
          }
        } else if (this.lastActivePane === 'right' && rightEditor && rightEditor.value.trim()) {
          const res = this.syncEngine.convertImmediate(rightEditor.value, rightFmt, leftFmt);
          if (res.success) {
            if (leftEditor) {
              leftEditor.value = res.result;
              UI.updateGutter('left');
              UI.updateMetrics('left', leftEditor.value);
            }
            UI.clearErrorBanner('right');
            UI.setStatus('synced');
            UI.showToast(`Converted to ${leftFmt.toUpperCase()}`, 'info');
          }
        }
      }
    },

    swapDirection() {
      const leftEditor = UI.$('#leftEditor') || UI.$('#left-editor');
      const rightEditor = UI.$('#rightEditor') || UI.$('#right-editor');
      const leftFmtSelect = UI.$('#leftFormat') || UI.$('#left-format-select');
      const rightFmtSelect = UI.$('#rightFormat') || UI.$('#right-format-select');

      if (!leftEditor || !rightEditor || !leftFmtSelect || !rightFmtSelect) return;

      if (this.syncEngine) {
        this.syncEngine.cancelPending();
      }

      const prevLeftVal = leftEditor.value;
      const prevRightVal = rightEditor.value;
      const prevLeftFmt = leftFmtSelect.value;
      const prevRightFmt = rightFmtSelect.value;

      // Swap values & formats
      leftFmtSelect.value = prevRightFmt;
      rightFmtSelect.value = prevLeftFmt;
      leftEditor.value = prevRightVal;
      rightEditor.value = prevLeftVal;

      // Update mobile labels
      const mLeft = UI.$('#mobileLeftFormatLabel');
      const mRight = UI.$('#mobileRightFormatLabel');
      if (mLeft) mLeft.textContent = prevRightFmt.toUpperCase();
      if (mRight) mRight.textContent = prevLeftFmt.toUpperCase();

      UI.updateGutter('left');
      UI.updateGutter('right');
      UI.updateMetrics('left', leftEditor.value);
      UI.updateMetrics('right', rightEditor.value);

      // Trigger fresh sync
      if (this.syncEngine) {
        this.syncEngine.executeSync('left', leftEditor.value, leftFmtSelect.value, rightFmtSelect.value);
      }

      UI.showToast(`Swapped: ${prevRightFmt.toUpperCase()} ⇄ ${prevLeftFmt.toUpperCase()}`, 'info');
    },

    triggerManualSync() {
      const srcPane = this.lastActivePane;
      const srcEditor = UI.$(`#${srcPane}Editor`) || UI.$(`#${srcPane}-editor`);
      const srcFmt = (UI.$(`#${srcPane}Format`) || UI.$(`#${srcPane}-format-select`)).value;
      const tgtPane = srcPane === 'left' ? 'right' : 'left';
      const tgtFmt = (UI.$(`#${tgtPane}Format`) || UI.$(`#${tgtPane}-format-select`)).value;

      if (this.syncEngine && srcEditor) {
        this.syncEngine.cancelPending();
        this.syncEngine.executeSync(srcPane, srcEditor.value, srcFmt, tgtFmt);
        UI.showToast('Manual synchronization executed', 'info');
      }
    },

    clearPaneWithUndo(pane) {
      const editor = UI.$(`#${pane}Editor`) || UI.$(`#${pane}-editor`);
      const peerPane = pane === 'left' ? 'right' : 'left';
      const peerEditor = UI.$(`#${peerPane}Editor`) || UI.$(`#${peerPane}-editor`);

      if (!editor || !peerEditor) return;

      if (this.syncEngine) {
        this.syncEngine.cancelPending();
      }

      const snapshot = {
        pane: pane,
        paneText: editor.value,
        peerText: peerEditor.value
      };

      editor.value = '';
      peerEditor.value = '';
      UI.updateGutter('left');
      UI.updateGutter('right');
      UI.updateMetrics('left', '');
      UI.updateMetrics('right', '');
      UI.clearErrorBanner('left');
      UI.clearErrorBanner('right');
      UI.setStatus('idle');

      UI.showUndoSnackbar(() => {
        if (this.syncEngine) {
          this.syncEngine.cancelPending();
        }
        editor.value = snapshot.paneText;
        peerEditor.value = snapshot.peerText;
        UI.updateGutter('left');
        UI.updateGutter('right');
        UI.updateMetrics('left', (UI.$('#leftEditor') || UI.$('#left-editor')).value);
        UI.updateMetrics('right', (UI.$('#rightEditor') || UI.$('#right-editor')).value);
        this.triggerManualSync();
      }, 5000);
    },

    prettifyPane(pane) {
      const editor = UI.$(`#${pane}Editor`) || UI.$(`#${pane}-editor`);
      const fmtSelect = UI.$(`#${pane}Format`) || UI.$(`#${pane}-format-select`);
      if (!editor || !fmtSelect || !editor.value.trim()) return;

      const fmt = fmtSelect.value;
      if (!this.syncEngine) return;

      const res = this.syncEngine.convertImmediate(editor.value, fmt, fmt);
      if (res.success) {
        editor.value = res.result;
        UI.updateGutter(pane);
        UI.updateMetrics(pane, editor.value);
        UI.showToast(`Prettified ${fmt.toUpperCase()}`, 'success');
      } else {
        UI.showToast(`Cannot format: ${res.error.message}`, 'error');
      }
    },

    loadFileIntoPane(pane, file) {
      const ext = file.name.split('.').pop().toLowerCase();
      let matchedFmt = null;
      if (ext === 'json') matchedFmt = 'json';
      else if (ext === 'yaml' || ext === 'yml') matchedFmt = 'yaml';
      else if (ext === 'csv') matchedFmt = 'csv';
      else if (ext === 'xml') matchedFmt = 'xml';
      else if (ext === 'toml') matchedFmt = 'toml';

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const editor = UI.$(`#${pane}Editor`) || UI.$(`#${pane}-editor`);
        const fmtSelect = UI.$(`#${pane}Format`) || UI.$(`#${pane}-format-select`);

        if (matchedFmt && fmtSelect) {
          fmtSelect.value = matchedFmt;
        }

        if (editor) {
          editor.value = text;
          UI.updateGutter(pane);
          UI.updateMetrics(pane, text);
        }

        // Run sync
        const peerPane = pane === 'left' ? 'right' : 'left';
        const srcFmt = (UI.$(`#${pane}Format`) || UI.$(`#${pane}-format-select`)).value;
        const tgtFmt = (UI.$(`#${peerPane}Format`) || UI.$(`#${peerPane}-format-select`)).value;
        if (this.syncEngine && editor) {
          this.syncEngine.executeSync(pane, text, srcFmt, tgtFmt);
        }

        const sizeKb = (file.size / 1024).toFixed(1);
        UI.showToast(`Loaded "${file.name}" (${sizeKb} KB) as ${(matchedFmt || srcFmt).toUpperCase()}`, 'success');
      };
      reader.onerror = () => {
        UI.showToast(`Error reading file "${file.name}"`, 'error');
      };
      reader.readAsText(file, 'UTF-8');
    },

    loadSample(presetKey) {
      const preset = SAMPLE_PRESETS[presetKey];
      if (!preset) return;

      if (this.syncEngine) {
        this.syncEngine.cancelPending();
      }

      const leftEditor = UI.$('#leftEditor') || UI.$('#left-editor');
      const leftFmtSelect = UI.$('#leftFormat') || UI.$('#left-format-select');
      const rightFmtSelect = UI.$('#rightFormat') || UI.$('#right-format-select');

      if (preset.recommendedFrom && leftFmtSelect) leftFmtSelect.value = preset.recommendedFrom;
      if (preset.recommendedTo && rightFmtSelect) rightFmtSelect.value = preset.recommendedTo;

      // Update mobile labels
      const mLeft = UI.$('#mobileLeftFormatLabel');
      const mRight = UI.$('#mobileRightFormatLabel');
      if (mLeft && leftFmtSelect) mLeft.textContent = leftFmtSelect.value.toUpperCase();
      if (mRight && rightFmtSelect) mRight.textContent = rightFmtSelect.value.toUpperCase();

      if (leftEditor) {
        leftEditor.value = preset.data;
        UI.updateGutter('left');
        UI.updateMetrics('left', leftEditor.value);
      }

      // Execute conversion immediately
      if (this.syncEngine && leftEditor && leftFmtSelect && rightFmtSelect) {
        this.syncEngine.executeSync('left', leftEditor.value, leftFmtSelect.value, rightFmtSelect.value);
      }

      UI.showToast(`Loaded sample: ${preset.name}`, 'info');
    }
  };

  // Auto-bootstrap on DOMContentLoaded in browser
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => App.init());
    } else {
      App.init();
    }
  }

  return App;
});

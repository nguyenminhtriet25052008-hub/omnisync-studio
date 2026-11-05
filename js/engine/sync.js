/**
 * js/engine/sync.js - Bidirectional Synchronization State Machine & Coordinator
 * OmniSync Studio - Browser & Node.js Isomorphic Module
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const IR = require('./ir.js');
    const Diff = require('./diff.js');
    const Validator = require('./validator.js');
    let parsers = {};
    try {
      parsers = {
        json: require('../parsers/json.js'),
        yaml: require('../parsers/yaml.js'),
        csv: require('../parsers/csv.js'),
        xml: require('../parsers/xml.js'),
        toml: require('../parsers/toml.js')
      };
    } catch (_) {}
    const mod = factory(IR, Diff, Validator, root, parsers);
    module.exports = mod;
    module.exports.SyncEngine = mod;
  } else {
    root.OmniSync = root.OmniSync || {};
    const IR = root.OmniSync.IR || root.IR;
    const Diff = root.OmniSync.Diff || root.Diff;
    const Validator = root.OmniSync.Validator || root.Validator;
    const parsers = (root.OmniSync && root.OmniSync.parsers) || {};
    const mod = factory(IR, Diff, Validator, root, parsers);
    root.OmniSync.SyncEngine = mod;
    root.SyncEngine = mod;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (IR, Diff, Validator, root, defaultParsers) {
  'use strict';
  defaultParsers = defaultParsers || {};

  class SyncEngine {
    /**
     * @param {object} [config]
     * @param {number} [config.debounceMs=250]
     * @param {object} [config.parsers] - Registry of parsers { json, yaml, csv, xml, toml }
     * @param {Function} [config.onSync] - Callback on successful sync
     * @param {Function} [config.onError] - Callback on syntax or validation error
     * @param {Function} [config.onStatusChange] - Callback on FSM state transition
     */
    constructor(config) {
      config = config || {};
      this.debounceMs = config.debounceMs !== undefined ? config.debounceMs : 250;
      const browserParsers = (typeof root !== 'undefined' && root && root.OmniSync && root.OmniSync.parsers) || {};
      this.parsers = Object.assign({}, defaultParsers, browserParsers, config.parsers || {});
      this.onSync = config.onSync || function () {};
      this.onError = config.onError || function () {};
      this.onStatusChange = config.onStatusChange || function () {};

      // FSM State
      this.state = 'IDLE'; // 'IDLE' | 'EDITING' | 'VALIDATING' | 'CONVERTING' | 'SYNCED' | 'ERROR'
      this.sourcePane = 'left'; // 'left' | 'right'
      this.isSyncing = false; // Mutex flag preventing feedback loops
      this.lastSyncedIR = null;
      this.debounceTimer = null;
    }

    /**
     * Transitions FSM to a new state and triggers callback.
     */
    setState(newState) {
      if (this.state !== newState) {
        this.state = newState;
        this.onStatusChange(this.state);
      }
    }

    /**
     * Handles typing in an editor pane with active debounce.
     * @param {'left'|'right'} sourcePane - The pane the user is typing in
     * @param {string} text - Raw text from the source editor
     * @param {string} fromFormat - Format of source ('json', 'yaml', 'csv', 'xml', 'toml')
     * @param {string} toFormat - Format of destination
     */
    handleInput(sourcePane, text, fromFormat, toFormat) {
      // Loop guard: if we are currently updating target pane programmatically, ignore event!
      if (this.isSyncing) return;

      // Pane focus switch: cancel pending timer from alternate pane
      if (this.sourcePane !== sourcePane) {
        this.cancelPending();
        this.sourcePane = sourcePane;
      }

      this.setState('EDITING');
      this.cancelPending();

      const self = this;
      this.debounceTimer = setTimeout(function () {
        self.executeSync(sourcePane, text, fromFormat, toFormat);
      }, this.debounceMs);
    }

    /**
     * Cancels any pending debounce timer.
     */
    cancelPending() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
    }

    /**
     * Core execution pipeline: Parse -> Validate -> Normalize -> Compare -> Serialize.
     */
    executeSync(sourcePane, text, fromFormat, toFormat) {
      this.cancelPending();
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.setState('VALIDATING');

      // 1. Resolve parser and serializer
      const parser = this.parsers[fromFormat.toLowerCase()];
      const serializer = this.parsers[toFormat.toLowerCase()];

      if (!parser || !serializer) {
        const err = { message: `Missing parser or serializer for ${fromFormat} -> ${toFormat}` };
        this.setState('ERROR');
        this.onError({ sourcePane: sourcePane, format: fromFormat, error: err });
        return;
      }

      // 2. Parse source text to IR
      let parseResult;
      try {
        if (!text || !text.trim()) {
          // Empty input yields empty IR cleanly
          this.lastSyncedIR = null;
          this.setState('SYNCED');
          this.onSync({
            sourcePane: sourcePane,
            targetPane: sourcePane === 'left' ? 'right' : 'left',
            sourceFormat: fromFormat,
            targetFormat: toFormat,
            text: '',
            ir: null,
            diff: { patches: [], summary: 'Empty document' },
            stats: IR.getStats(null),
            durationMs: 0
          });
          return;
        }

        parseResult = parser.parse(text);
      } catch (e) {
        parseResult = { success: false, error: e };
      }

      // Check parse failure
      if (parseResult && parseResult.success === false) {
        this.setState('ERROR');
        const locatedError = this._locateError(fromFormat, text, parseResult.error);
        // NON-DESTRUCTIVE ISOLATION: Peer pane is NOT updated!
        this.onError({ sourcePane: sourcePane, format: fromFormat, error: locatedError });
        return;
      }

      const rawData = (parseResult && parseResult.data !== undefined) ? parseResult.data : parseResult;
      const canonicalIR = IR.normalize(rawData);

      // 3. Cycle Breaker: Semantic Equivalence Check
      if (this.lastSyncedIR !== null && IR.deepEquals(canonicalIR, this.lastSyncedIR)) {
        this.setState('SYNCED');
        return;
      }

      // 4. Calculate Structural Diff
      const diff = Diff.compare(this.lastSyncedIR, canonicalIR);
      const stats = IR.getStats(canonicalIR);

      // 5. Serialize to Target Format
      this.setState('CONVERTING');
      let serializeResult;
      try {
        if (typeof serializer.stringify === 'function') {
          serializeResult = serializer.stringify(canonicalIR);
        } else if (typeof serializer.serialize === 'function') {
          serializeResult = serializer.serialize(canonicalIR);
        } else {
          throw new Error(`Serializer for ${toFormat} has no stringify/serialize method`);
        }
      } catch (e) {
        this.setState('ERROR');
        this.onError({ sourcePane: sourcePane, format: toFormat, error: { message: `Serialization failed: ${e.message}` } });
        return;
      }

      const outputText = (serializeResult && serializeResult.text !== undefined)
        ? serializeResult.text
        : (typeof serializeResult === 'string' ? serializeResult : JSON.stringify(serializeResult));

      // 6. Update Peer Pane under Mutex Guard
      const targetPane = sourcePane === 'left' ? 'right' : 'left';
      const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = Math.max(0, endTime - startTime);

      this.isSyncing = true;
      try {
        this.lastSyncedIR = canonicalIR;
        this.setState('SYNCED');
        this.onSync({
          sourcePane: sourcePane,
          targetPane: targetPane,
          sourceFormat: fromFormat,
          targetFormat: toFormat,
          text: outputText,
          ir: canonicalIR,
          diff: diff,
          stats: stats,
          durationMs: durationMs
        });
      } finally {
        this.isSyncing = false;
      }
    }

    /**
     * Immediate programmatic conversion API (bypasses debounce).
     */
    convertImmediate(text, fromFormat, toFormat, options) {
      options = options || {};
      const parser = this.parsers[fromFormat.toLowerCase()];
      const serializer = this.parsers[toFormat.toLowerCase()];

      if (!parser) return { success: false, error: { message: `Unknown source format: ${fromFormat}` } };
      if (!serializer) return { success: false, error: { message: `Unknown target format: ${toFormat}` } };

      try {
        if (!text || !text.trim()) {
          return { success: true, result: '', ir: null, stats: IR.getStats(null) };
        }

        const parseRes = parser.parse(text, options);
        if (parseRes && parseRes.success === false) {
          const located = this._locateError(fromFormat, text, parseRes.error);
          return { success: false, error: located };
        }

        const data = (parseRes && parseRes.data !== undefined) ? parseRes.data : parseRes;
        const ir = IR.normalize(data, options);

        let serRes;
        if (typeof serializer.stringify === 'function') {
          serRes = serializer.stringify(ir, options);
        } else if (typeof serializer.serialize === 'function') {
          serRes = serializer.serialize(ir, options);
        } else {
          throw new Error('Serializer has no stringify/serialize method');
        }

        const resultText = (serRes && serRes.text !== undefined) ? serRes.text : serRes;
        return {
          success: true,
          result: resultText,
          ir: ir,
          stats: IR.getStats(ir)
        };
      } catch (err) {
        const located = this._locateError(fromFormat, text, err);
        return { success: false, error: located };
      }
    }

    /**
     * Interface contract: getDiff between two data objects
     */
    getDiff(dataA, dataB) {
      return Diff.compare(dataA, dataB);
    }

    _locateError(format, text, err) {
      if (err && typeof err.line === 'number' && typeof err.column === 'number' && err.line > 0 && err.column > 0) {
        return {
          line: err.line,
          column: err.column,
          message: (err && err.message) || 'Syntax error',
          snippet: (err && err.snippet) || (Validator && typeof Validator.generateCodeFrame === 'function'
            ? Validator.generateCodeFrame(text, err.line, err.column, err.message)
            : '')
        };
      }
      switch (format.toLowerCase()) {
        case 'json': return Validator.locateJsonError(text, err);
        case 'yaml': return Validator.locateYamlError(text, err);
        case 'csv': return Validator.locateCsvError(text, err);
        case 'xml': return Validator.locateXmlError(text, err);
        case 'toml': return Validator.locateTomlError(text, err);
        default:
          return { line: 1, column: 1, message: err ? err.message : 'Syntax error', snippet: '' };
      }
    }
  }

  return SyncEngine;
});

/**
 * js/engine/validator.js - Multi-Format Diagnostic Locator & Schema Validator
 * OmniSync Studio - Browser & Node.js Isomorphic Module
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const mod = factory();
    module.exports = mod;
    module.exports.Validator = mod;
  } else {
    root.OmniSync = root.OmniSync || {};
    const mod = factory();
    root.OmniSync.Validator = mod;
    root.Validator = mod;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const Validator = {
    /**
     * Converts a 0-based character offset into 1-based line and column numbers.
     * @param {string} text - Source text
     * @param {number} position - 0-based character position
     * @returns {{ line: number, column: number }}
     */
    positionToCoordinates: function (text, position) {
      if (!text || typeof text !== 'string') return { line: 1, column: 1 };
      const pos = Math.max(0, Math.min(position, text.length));

      let line = 1;
      let lastNewline = -1;

      for (let i = 0; i < pos; i++) {
        const ch = text.charCodeAt(i);
        if (ch === 10 /* '\n' */) {
          line++;
          lastNewline = i;
        }
      }

      const column = pos - lastNewline;
      return { line: line, column: Math.max(1, column) };
    },

    /**
     * Generates a 3-line visual caret (^) code frame.
     * @param {string} text - Full source text
     * @param {number} line - 1-based line number
     * @param {number} column - 1-based column number
     * @param {string} [message] - Error message label
     * @returns {string} Formatted code snippet
     */
    generateCodeFrame: function (text, line, column, message) {
      message = message || '';
      if (!text || typeof text !== 'string') return '';
      const lines = text.split(/\r?\n/);
      const targetLineIdx = line - 1;

      if (targetLineIdx < 0 || targetLineIdx >= lines.length) {
        return message ? `> Line ${line}, Col ${column}: ${message}` : '';
      }

      const startIdx = Math.max(0, targetLineIdx - 1);
      const endIdx = Math.min(lines.length - 1, targetLineIdx + 1);
      const gutterWidth = String(endIdx + 1).length;

      const output = [];

      for (let i = startIdx; i <= endIdx; i++) {
        const lineNumStr = String(i + 1).padStart(gutterWidth, ' ');
        const isTarget = (i === targetLineIdx);
        const prefix = isTarget ? '> ' : '  ';
        const lineContent = lines[i];

        output.push(`${prefix}${lineNumStr} | ${lineContent}`);

        if (isTarget) {
          const colIndent = Math.max(0, column - 1);
          let visualCol = 0;
          for (let c = 0; c < colIndent && c < lineContent.length; c++) {
            visualCol += (lineContent.charCodeAt(c) === 9 /* tab */) ? 2 : 1;
          }
          const caretIndent = ' '.repeat(visualCol);
          const gutterIndent = ' '.repeat(gutterWidth);
          const msgSuffix = message ? ` ${message}` : '';
          output.push(`    ${gutterIndent} | ${caretIndent}^${msgSuffix}`);
        }
      }

      return output.join('\n');
    },

    /**
     * Intercepts and locates JSON parsing errors.
     */
    locateJsonError: function (text, err) {
      const msg = err ? (err.message || String(err)) : 'Syntax error';
      if (err && typeof err.line === 'number' && typeof err.column === 'number' && err.line > 0 && err.column > 0) {
        return {
          line: err.line,
          column: err.column,
          message: msg,
          snippet: (err && err.snippet) || this.generateCodeFrame(text, err.line, err.column, msg)
        };
      }
      let line = 1;
      let column = 1;
      let matched = false;

      // Chrome/V8: "Unexpected token ... at position 42"
      const posMatch = msg.match(/at position (\d+)/i) || msg.match(/in JSON at position (\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const coords = this.positionToCoordinates(text, pos);
        line = coords.line;
        column = coords.column;
        matched = true;
      }

      // Firefox: "at line 5 column 12"
      if (!matched) {
        const lineColMatch = msg.match(/line (\d+) column (\d+)/i);
        if (lineColMatch) {
          line = parseInt(lineColMatch[1], 10);
          column = parseInt(lineColMatch[2], 10);
          matched = true;
        }
      }

      // Fallback: simple heuristic scanner
      if (!matched && text) {
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (/,\s*[}\]]/.test(l)) {
            line = i + 1;
            column = l.indexOf(',') + 1;
            break;
          }
        }
      }

      const snippet = this.generateCodeFrame(text, line, column, msg);
      return { line: line, column: column, message: msg, snippet: snippet };
    },

    /**
     * Intercepts and locates YAML parsing errors, specifically flagging tab violations.
     */
    locateYamlError: function (text, err) {
      const msg = err ? (err.message || String(err)) : 'YAML Syntax Error';
      if (text) {
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const match = line.match(/^(\t+| +\t+)/);
          if (match) {
            const tabCol = line.indexOf('\t') + 1;
            const tabMsg = 'YAML forbids tab characters for indentation; use spaces.';
            return {
              line: i + 1,
              column: tabCol,
              message: tabMsg,
              snippet: this.generateCodeFrame(text, i + 1, tabCol, tabMsg)
            };
          }
        }
      }

      const line = (err && err.line) || 1;
      const column = (err && err.column) || 1;
      return {
        line: line,
        column: column,
        message: msg,
        snippet: this.generateCodeFrame(text, line, column, msg)
      };
    },

    /**
     * Intercepts and locates CSV errors (unterminated quotes, ragged rows).
     */
    locateCsvError: function (text, err) {
      const msg = err ? (err.message || String(err)) : 'CSV Syntax Error';
      const line = (err && err.line) || 1;
      const column = (err && err.column) || 1;
      return {
        line: line,
        column: column,
        message: msg,
        snippet: this.generateCodeFrame(text, line, column, msg)
      };
    },

    /**
     * Intercepts XML parsing errors from DOMParser or Node XML parser.
     */
    locateXmlError: function (text, err) {
      const msg = err ? (err.message || String(err)) : 'XML Syntax Error';
      let line = (err && err.line) || 1;
      let column = (err && err.column) || 1;

      if (line === 1 && column === 1) {
        const lineMatch = msg.match(/line (\d+)/i) || msg.match(/error on line (\d+)/i);
        const colMatch = msg.match(/column (\d+)/i) || msg.match(/at column (\d+)/i);

        if (lineMatch) line = parseInt(lineMatch[1], 10);
        if (colMatch) column = parseInt(colMatch[1], 10);
      }

      return {
        line: line,
        column: column,
        message: msg,
        snippet: (err && err.snippet) || this.generateCodeFrame(text, line, column, msg)
      };
    },

    /**
     * Intercepts TOML parsing errors.
     */
    locateTomlError: function (text, err) {
      const msg = err ? (err.message || String(err)) : 'TOML Syntax Error';
      const line = (err && err.line) || 1;
      const column = (err && err.column) || 1;
      return {
        line: line,
        column: column,
        message: msg,
        snippet: (err && err.snippet) || this.generateCodeFrame(text, line, column, msg)
      };
    },

    /**
     * Lightweight JSON Schema Validator (Draft-07 / 2020-12 subset).
     * @param {object} schema - JSON Schema definition
     * @param {any} data - Canonical IR data to validate
     * @returns {{ valid: boolean, errors: Array<{ path: string, message: string, keyword: string }> }}
     */
    validateSchema: function (schema, data) {
      const errors = [];

      function check(subSchema, val, path) {
        if (!subSchema || typeof subSchema !== 'object') return;

        // Type assertion
        if (subSchema.type) {
          const types = Array.isArray(subSchema.type) ? subSchema.type : [subSchema.type];
          let matched = false;
          for (let i = 0; i < types.length; i++) {
            const t = types[i];
            if (t === 'null' && val === null) matched = true;
            else if (t === 'string' && typeof val === 'string') matched = true;
            else if (t === 'boolean' && typeof val === 'boolean') matched = true;
            else if (t === 'number' && typeof val === 'number') matched = true;
            else if (t === 'integer' && typeof val === 'number' && Number.isInteger(val)) matched = true;
            else if (t === 'array' && Array.isArray(val)) matched = true;
            else if (t === 'object' && val !== null && typeof val === 'object' && !Array.isArray(val)) matched = true;
          }
          if (!matched) {
            errors.push({
              path: path || '/',
              keyword: 'type',
              message: `Expected type ${types.join('|')}, got ${val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val}`
            });
            return;
          }
        }

        // Numeric constraints
        if (typeof val === 'number') {
          if (subSchema.minimum !== undefined && val < subSchema.minimum) {
            errors.push({ path: path, keyword: 'minimum', message: `Must be >= ${subSchema.minimum}` });
          }
          if (subSchema.maximum !== undefined && val > subSchema.maximum) {
            errors.push({ path: path, keyword: 'maximum', message: `Must be <= ${subSchema.maximum}` });
          }
        }

        // String constraints
        if (typeof val === 'string') {
          if (subSchema.minLength !== undefined && val.length < subSchema.minLength) {
            errors.push({ path: path, keyword: 'minLength', message: `Length must be >= ${subSchema.minLength}` });
          }
          if (subSchema.maxLength !== undefined && val.length > subSchema.maxLength) {
            errors.push({ path: path, keyword: 'maxLength', message: `Length must be <= ${subSchema.maxLength}` });
          }
          if (subSchema.pattern) {
            try {
              const reg = new RegExp(subSchema.pattern);
              if (!reg.test(val)) {
                errors.push({ path: path, keyword: 'pattern', message: `Does not match pattern: ${subSchema.pattern}` });
              }
            } catch (_) {}
          }
        }

        // Array constraints
        if (Array.isArray(val)) {
          if (subSchema.minItems !== undefined && val.length < subSchema.minItems) {
            errors.push({ path: path, keyword: 'minItems', message: `Array item count must be >= ${subSchema.minItems}` });
          }
          if (subSchema.maxItems !== undefined && val.length > subSchema.maxItems) {
            errors.push({ path: path, keyword: 'maxItems', message: `Array item count must be <= ${subSchema.maxItems}` });
          }
          if (subSchema.items && typeof subSchema.items === 'object') {
            for (let i = 0; i < val.length; i++) {
              check(subSchema.items, val[i], `${path}/${i}`);
            }
          }
        }

        // Object constraints
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          if (Array.isArray(subSchema.required)) {
            for (let i = 0; i < subSchema.required.length; i++) {
              const req = subSchema.required[i];
              if (!Object.prototype.hasOwnProperty.call(val, req)) {
                errors.push({ path: path, keyword: 'required', message: `Missing required property: '${req}'` });
              }
            }
          }
          if (subSchema.properties) {
            const keys = Object.keys(subSchema.properties);
            for (let i = 0; i < keys.length; i++) {
              const k = keys[i];
              if (Object.prototype.hasOwnProperty.call(val, k)) {
                check(subSchema.properties[k], val[k], `${path}/${k}`);
              }
            }
          }
        }
      }

      check(schema, data, '');
      return { valid: errors.length === 0, errors: errors };
    },

    /**
     * Returns cross-format semantic conversion notices.
     */
    getCompatibilityWarnings: function (fromFormat, toFormat, ir) {
      const warnings = [];
      if (!ir) return warnings;

      if (toFormat === 'csv') {
        if (!Array.isArray(ir) && typeof ir === 'object') {
          warnings.push('Notice: Single object will be rendered as a 1-row CSV table.');
        }
        let hasDeep = false;
        function checkNest(node, d) {
          if (d > 1 && typeof node === 'object' && node !== null) hasDeep = true;
          if (typeof node === 'object' && node !== null) {
            for (let k in node) checkNest(node[k], d + 1);
          }
        }
        checkNest(ir, 0);
        if (hasDeep) {
          warnings.push('Notice: Nested objects flattened to dot-notation columns (e.g. user.address.city).');
        }
      }

      if (toFormat === 'toml' && Array.isArray(ir)) {
        warnings.push('Notice: TOML requires a root table. Root array will be wrapped under the "items" key.');
      }

      if (toFormat === 'xml') {
        if (Array.isArray(ir) || (typeof ir === 'object' && ir !== null && Object.keys(ir).length > 1)) {
          warnings.push('Notice: XML requires a single root element. Wrapped in synthetic <root> element.');
        }
      }

      return warnings;
    }
  };

  return Validator;
});

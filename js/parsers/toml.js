/**
 * OmniSync Data Studio - TOML Parser & Serializer
 * Zero-dependency pure JavaScript TOML v1.0.0 engine.
 * Compatible with Node.js and Browser environments.
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const mod = factory();
    module.exports = mod;
    module.exports.TOMLParser = mod;
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.parsers = root.OmniSync.parsers || {};
    const mod = factory();
    root.OmniSync.parsers.toml = mod;
    root.TOMLParser = mod;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function createCodeSnippet(text, line, col, context) {
    context = context !== undefined ? context : 1;
    if (!text || typeof text !== 'string') return '';
    const lines = text.split(/\r?\n/);
    const start = Math.max(1, line - context);
    const end = Math.min(lines.length, line + context);
    const maxDigits = String(end).length;
    const out = [];

    for (let l = start; l <= end; l++) {
      const prefix = String(l).padStart(maxDigits, ' ') + ' | ';
      out.push(prefix + (lines[l - 1] || ''));
      if (l === line) {
        const caretIndent = ' '.repeat(maxDigits + 3 + Math.max(0, col - 1));
        out.push(caretIndent + '^');
      }
    }
    return out.join('\n');
  }

  function isUnsafeKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  function parse(tomlString, options) {
    const text = String(tomlString || '');
    if (!text.trim()) {
      return { success: true, data: {} };
    }

    let index = 0;
    const len = text.length;

    function getCoords(pos) {
      let line = 1;
      let col = 1;
      const target = Math.min(Math.max(0, pos), text.length);
      for (let i = 0; i < target; i++) {
        if (text[i] === '\n') {
          line++;
          col = 1;
        } else if (text[i] !== '\r') {
          col++;
        }
      }
      return { line, column: col };
    }

    function errorAt(pos, msg) {
      const coords = getCoords(pos);
      return {
        success: false,
        error: {
          message: msg,
          line: coords.line,
          column: coords.column,
          snippet: createCodeSnippet(text, coords.line, coords.column)
        }
      };
    }

    const root = {};
    let currentTarget = root;
    const definedTables = new Set();
    const definedKeysByTarget = new Map();

    function markKeyDefined(targetObj, key, pos) {
      if (!definedKeysByTarget.has(targetObj)) {
        definedKeysByTarget.set(targetObj, new Set());
      }
      const keySet = definedKeysByTarget.get(targetObj);
      if (keySet.has(key)) {
        throw { pos: pos, message: `Duplicate key '${key}' already defined in this table` };
      }
      keySet.add(key);
    }

    function skipWhitespace(skipNewlines) {
      while (index < len) {
        const ch = text[index];
        if (ch === ' ' || ch === '\t' || ch === '\r') {
          index++;
        } else if (skipNewlines && ch === '\n') {
          index++;
        } else if (ch === '#') {
          // Skip comment to end of line
          while (index < len && text[index] !== '\n') index++;
        } else {
          break;
        }
      }
    }

    function parseKeySegment() {
      skipWhitespace(false);
      if (index >= len) return null;

      const startPos = index;
      const ch = text[index];

      // Basic quoted key
      if (ch === '"') {
        index++;
        let val = '';
        while (index < len && text[index] !== '"') {
          if (text[index] === '\\') {
            index++;
            if (index >= len) throw { pos: startPos, message: 'Unclosed quoted key escape sequence' };
            const esc = text[index];
            val += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
          } else {
            val += text[index];
          }
          index++;
        }
        if (index >= len) throw { pos: startPos, message: 'Unclosed quoted key' };
        index++; // skip closing quote
        return val;
      }

      // Literal quoted key
      if (ch === "'") {
        index++;
        const endQuote = text.indexOf("'", index);
        if (endQuote === -1) throw { pos: startPos, message: 'Unclosed literal key' };
        const val = text.slice(index, endQuote);
        index = endQuote + 1;
        return val;
      }

      // Bare key: [A-Za-z0-9_-]+
      const bareMatch = /^[A-Za-z0-9_\-]+/.exec(text.slice(index));
      if (!bareMatch) {
        throw { pos: index, message: 'Invalid character in key name' };
      }
      index += bareMatch[0].length;
      return bareMatch[0];
    }

    function parseFullKey() {
      const segments = [];
      const first = parseKeySegment();
      if (first === null) return null;
      segments.push(first);

      while (index < len) {
        skipWhitespace(false);
        if (index < len && text[index] === '.') {
          index++;
          const nextSeg = parseKeySegment();
          if (nextSeg === null) throw { pos: index, message: 'Expected key segment after dot' };
          segments.push(nextSeg);
        } else {
          break;
        }
      }
      return segments;
    }

    function parseValue() {
      skipWhitespace(false);
      if (index >= len) throw { pos: index, message: 'Unexpected end of input, expected value' };

      const startPos = index;

      // Multiline basic string """
      if (text.startsWith('"""', index)) {
        index += 3;
        if (text[index] === '\n') index++;
        else if (text.startsWith('\r\n', index)) index += 2;

        let str = '';
        while (index < len && !text.startsWith('"""', index)) {
          if (text[index] === '\\') {
            if (text[index + 1] === '\n') {
              index += 2;
              while (index < len && (text[index] === ' ' || text[index] === '\t' || text[index] === '\n' || text[index] === '\r')) index++;
              continue;
            }
            if (text.startsWith('\r\n', index + 1)) {
              index += 3;
              while (index < len && (text[index] === ' ' || text[index] === '\t' || text[index] === '\n' || text[index] === '\r')) index++;
              continue;
            }
            const esc = text[index + 1];
            str += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
            index += 2;
          } else {
            str += text[index];
            index++;
          }
        }
        if (index >= len) throw { pos: startPos, message: 'Unclosed multiline basic string """' };
        index += 3;
        return str;
      }

      // Multiline literal string '''
      if (text.startsWith("'''", index)) {
        index += 3;
        if (text[index] === '\n') index++;
        else if (text.startsWith('\r\n', index)) index += 2;

        const endPos = text.indexOf("'''", index);
        if (endPos === -1) throw { pos: startPos, message: "Unclosed multiline literal string '''" };
        const str = text.slice(index, endPos);
        index = endPos + 3;
        return str;
      }

      // Basic string "..."
      if (text[index] === '"') {
        index++;
        let str = '';
        while (index < len && text[index] !== '"') {
          if (text[index] === '\n' || text[index] === '\r') {
            throw { pos: index, message: 'Single-line basic string cannot contain unescaped newline' };
          }
          if (text[index] === '\\') {
            index++;
            if (index >= len) throw { pos: startPos, message: 'Unclosed escape in string' };
            const esc = text[index];
            str += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
          } else {
            str += text[index];
          }
          index++;
        }
        if (index >= len) throw { pos: startPos, message: 'Unclosed string quote' };
        index++;
        return str;
      }

      // Literal string '...'
      if (text[index] === "'") {
        index++;
        const endQuote = text.indexOf("'", index);
        if (endQuote === -1) throw { pos: startPos, message: 'Unclosed literal string quote' };
        const str = text.slice(index, endQuote);
        index = endQuote + 1;
        return str;
      }

      // Array [...]
      if (text[index] === '[') {
        index++;
        const arr = [];
        while (index < len) {
          skipWhitespace(true);
          if (index < len && text[index] === ']') {
            index++;
            return arr;
          }
          const elem = parseValue();
          arr.push(elem);
          skipWhitespace(true);
          if (index < len && text[index] === ',') {
            index++;
          } else if (index < len && text[index] === ']') {
            index++;
            return arr;
          } else {
            throw { pos: index, message: "Expected ',' or ']' inside array" };
          }
        }
        throw { pos: startPos, message: 'Unclosed array bracket [' };
      }

      // Inline table {...}
      if (text[index] === '{') {
        index++;
        const inlineObj = {};
        while (index < len) {
          skipWhitespace(false);
          if (index < len && text[index] === '}') {
            index++;
            return inlineObj;
          }
          const keyParts = parseFullKey();
          if (!keyParts) throw { pos: index, message: 'Expected key inside inline table' };
          skipWhitespace(false);
          if (index >= len || text[index] !== '=') throw { pos: index, message: "Expected '=' after key in inline table" };
          index++;
          const val = parseValue();
          if (!isUnsafeKey(keyParts[0])) {
            inlineObj[keyParts[0]] = val;
          }
          skipWhitespace(false);
          if (index < len && text[index] === ',') {
            index++;
          } else if (index < len && text[index] === '}') {
            index++;
            return inlineObj;
          } else {
            throw { pos: index, message: "Expected ',' or '}' inside inline table" };
          }
        }
        throw { pos: startPos, message: 'Unclosed inline table {' };
      }

      // Scalar literal: boolean, number, datetime
      const literalMatch = /^[^\s,\]}#]+/.exec(text.slice(index));
      if (!literalMatch) {
        throw { pos: index, message: 'Invalid or missing value token' };
      }
      const rawVal = literalMatch[0];
      index += rawVal.length;

      // Booleans
      if (rawVal === 'true') return true;
      if (rawVal === 'false') return false;

      // Special floats
      if (rawVal === 'inf' || rawVal === '+inf') return Infinity;
      if (rawVal === '-inf') return -Infinity;
      if (rawVal === 'nan' || rawVal === '+nan' || rawVal === '-nan') return NaN;

      // Date-times (ISO 8601)
      if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(rawVal)) {
        return rawVal;
      }

      // Integers with bases
      const cleanNum = rawVal.replace(/_/g, '');
      if (/^0x[0-9a-fA-F]+$/.test(cleanNum)) return parseInt(cleanNum, 16);
      if (/^0o[0-7]+$/.test(cleanNum)) return parseInt(cleanNum.slice(2), 8);
      if (/^0b[01]+$/.test(cleanNum)) return parseInt(cleanNum.slice(2), 2);

      // Decimal numbers
      if (/^[+-]?\d+$/.test(cleanNum)) return parseInt(cleanNum, 10);
      if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleanNum)) return parseFloat(cleanNum);

      throw { pos: startPos, message: `Invalid scalar value '${rawVal}'` };
    }

    try {
      while (index < len) {
        skipWhitespace(false);

        if (index >= len) break;

        // Newline handling
        if (text[index] === '\n') {
          index++;
          continue;
        }

        // Table Header: [section] or [[array_section]]
        if (text[index] === '[') {
          const headerStart = index;
          index++;
          const isArrayOfTables = text[index] === '[';
          if (isArrayOfTables) index++;

          const tableKeySegments = parseFullKey();
          if (!tableKeySegments || tableKeySegments.length === 0) {
            throw { pos: headerStart, message: 'Empty table header' };
          }

          skipWhitespace(false);
          if (isArrayOfTables) {
            if (!text.startsWith(']]', index)) throw { pos: index, message: "Expected ']]' at end of table array header" };
            index += 2;
          } else {
            if (text[index] !== ']') throw { pos: index, message: "Expected ']' at end of table header" };
            index++;
          }

          // Navigate / construct target table
          let target = root;
          const fullPath = tableKeySegments.join('.');

          if (tableKeySegments.some(isUnsafeKey)) {
            currentTarget = null;
            continue;
          }

          if (isArrayOfTables) {
            for (let s = 0; s < tableKeySegments.length - 1; s++) {
              const seg = tableKeySegments[s];
              if (!Object.prototype.hasOwnProperty.call(target, seg) || !target[seg] || typeof target[seg] !== 'object') {
                target[seg] = {};
              }
              target = target[seg];
            }
            const lastSeg = tableKeySegments[tableKeySegments.length - 1];
            if (!Object.prototype.hasOwnProperty.call(target, lastSeg) || !Array.isArray(target[lastSeg])) {
              target[lastSeg] = [];
            }
            if (!Array.isArray(target[lastSeg])) {
              throw { pos: headerStart, message: `Cannot define array of tables '${fullPath}': already defined as non-array` };
            }
            const newEntry = {};
            target[lastSeg].push(newEntry);
            currentTarget = newEntry;
          } else {
            if (definedTables.has(fullPath)) {
              throw { pos: headerStart, message: `Cannot redefine existing table '${fullPath}'` };
            }
            definedTables.add(fullPath);

            for (let s = 0; s < tableKeySegments.length; s++) {
              const seg = tableKeySegments[s];
              if (!Object.prototype.hasOwnProperty.call(target, seg) || !target[seg] || typeof target[seg] !== 'object') {
                target[seg] = {};
              }
              target = target[seg];
            }
            currentTarget = target;
          }

          continue;
        }

        // Key = Value pair
        const lineStartPos = index;
        const keySegments = parseFullKey();
        if (!keySegments) {
          throw { pos: index, message: 'Expected key-value pair or section header' };
        }

        skipWhitespace(false);
        if (index >= len || text[index] !== '=') {
          throw { pos: index, message: "Expected '=' after key" };
        }
        index++; // skip '='

        const val = parseValue();

        if (!currentTarget) {
          continue;
        }
        if (keySegments.some(isUnsafeKey)) {
          continue;
        }

        // Assign value at dotted path inside currentTarget
        let targetNode = currentTarget;
        for (let k = 0; k < keySegments.length - 1; k++) {
          const seg = keySegments[k];
          if (!Object.prototype.hasOwnProperty.call(targetNode, seg) || !targetNode[seg] || typeof targetNode[seg] !== 'object') {
            targetNode[seg] = {};
          }
          targetNode = targetNode[seg];
        }

        const leafKey = keySegments[keySegments.length - 1];
        markKeyDefined(targetNode, leafKey, lineStartPos);
        targetNode[leafKey] = val;

        skipWhitespace(false);
        if (index < len && text[index] === '#') {
          while (index < len && text[index] !== '\n') index++;
        }
        if (index < len && text[index] === '\n') {
          index++;
        } else if (index < len) {
          throw { pos: index, message: 'Unexpected characters after key-value pair on same line' };
        }
      }

      return {
        success: true,
        data: root
      };
    } catch (err) {
      if (err && typeof err.pos === 'number') {
        return errorAt(err.pos, err.message);
      }
      return {
        success: false,
        error: { message: err.message || 'Unknown TOML parsing error', line: 1, column: 1, snippet: '' }
      };
    }
  }

  function serializeToml(data, options) {
    try {
      if (data === null || data === undefined) {
        return { success: true, text: '' };
      }

      options = options || {};
      const multilineStrings = options.multilineStrings !== false;
      let target = data;

      // Root Invariant: Root must be a table (object)
      if (Array.isArray(target)) {
        target = { items: target };
      } else if (typeof target !== 'object' || target === null) {
        target = { value: target };
      }

      function formatKey(key) {
        if (/^[A-Za-z0-9_\-]+$/.test(key)) return key;
        return JSON.stringify(key);
      }

      function formatScalarValue(val) {
        if (typeof val === 'string') {
          if (multilineStrings && val.includes('\n')) {
            return `"""\n${val.replace(/\\/g, '\\\\').replace(/"""/g, '\\"""')}\n"""`;
          }
          return JSON.stringify(val);
        }
        if (typeof val === 'number') {
          if (isNaN(val)) return 'nan';
          if (!isFinite(val)) return val > 0 ? 'inf' : '-inf';
          return String(val);
        }
        if (typeof val === 'boolean') {
          return val ? 'true' : 'false';
        }
        if (val === null || val === undefined) {
          return '""';
        }
        if (Array.isArray(val)) {
          return `[ ${val.map(formatScalarValue).join(', ')} ]`;
        }
        if (typeof val === 'object') {
          const pairs = Object.entries(val).map(([k, v]) => `${formatKey(k)} = ${formatScalarValue(v)}`);
          return `{ ${pairs.join(', ')} }`;
        }
        return String(val);
      }

      const outputLines = [];

      function serializeTable(obj, prefix) {
        const scalars = [];
        const subTables = [];
        const arrayTables = [];

        const entries = Object.entries(obj);
        for (let i = 0; i < entries.length; i++) {
          const key = entries[i][0];
          const val = entries[i][1];
          if (isUnsafeKey(key)) continue;
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
            arrayTables.push([key, val]);
          } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            subTables.push([key, val]);
          } else {
            scalars.push([key, val]);
          }
        }

        // Group 1: Output scalars first
        for (let i = 0; i < scalars.length; i++) {
          const k = scalars[i][0];
          const v = scalars[i][1];
          outputLines.push(`${formatKey(k)} = ${formatScalarValue(v)}`);
        }

        // Group 2: Output sub-tables
        for (let i = 0; i < subTables.length; i++) {
          const k = subTables[i][0];
          const v = subTables[i][1];
          const fullPath = prefix ? `${prefix}.${formatKey(k)}` : formatKey(k);
          outputLines.push(`\n[${fullPath}]`);
          serializeTable(v, fullPath);
        }

        // Group 3: Output array of tables
        for (let i = 0; i < arrayTables.length; i++) {
          const k = arrayTables[i][0];
          const v = arrayTables[i][1];
          const fullPath = prefix ? `${prefix}.${formatKey(k)}` : formatKey(k);
          for (let a = 0; a < v.length; a++) {
            outputLines.push(`\n[[${fullPath}]]`);
            serializeTable(v[a], fullPath);
          }
        }
      }

      serializeTable(target, '');

      return {
        success: true,
        text: outputLines.join('\n').trim()
      };
    } catch (err) {
      return {
        success: false,
        error: { message: err.message || 'Failed to serialize TOML' }
      };
    }
  }

  return {
    parse: parse,
    stringify: serializeToml
  };
});

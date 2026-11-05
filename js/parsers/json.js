/**
 * OmniSync Data Studio - JSON Parser & Serializer
 * RFC 8259 Compliant with Multi-Engine Diagnostic Locator
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.parsers = root.OmniSync.parsers || {};
    root.OmniSync.parsers.json = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function generateSnippet(text, line, column) {
    if (!text || typeof text !== 'string') return '';
    const lines = text.split(/\r?\n/);
    const targetLineIdx = line - 1;
    if (targetLineIdx < 0 || targetLineIdx >= lines.length) return '';

    const startIdx = Math.max(0, targetLineIdx - 1);
    const endIdx = Math.min(lines.length - 1, targetLineIdx + 1);
    const maxLineNumWidth = String(endIdx + 1).length;

    const frame = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const lineNumStr = String(i + 1).padStart(maxLineNumWidth, ' ');
      frame.push(`${lineNumStr} | ${lines[i]}`);
      if (i === targetLineIdx) {
        const caretIndent = ' '.repeat(maxLineNumWidth + 3 + Math.max(0, column - 1));
        frame.push(`${caretIndent}^`);
      }
    }
    return frame.join('\n');
  }

  function positionToLineCol(text, pos) {
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

  /**
   * Fast JSON syntax scanner fallback to pinpoint exact error character index
   */
  function scanJsonErrorIndex(text) {
    let i = 0;
    const len = text.length;

    function skipWs() {
      while (i < len && /\s/.test(text[i])) i++;
    }

    function parseVal() {
      skipWs();
      if (i >= len) return false;
      const ch = text[i];
      if (ch === '{') return parseObj();
      if (ch === '[') return parseArr();
      if (ch === '"') return parseStr();
      if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNum();
      if (text.startsWith('true', i)) { i += 4; return true; }
      if (text.startsWith('false', i)) { i += 5; return true; }
      if (text.startsWith('null', i)) { i += 4; return true; }
      return false;
    }

    function parseStr() {
      i++; // skip opening "
      while (i < len) {
        if (text[i] === '\\') {
          i += 2;
        } else if (text[i] === '"') {
          i++;
          return true;
        } else if (text[i] === '\n' || text[i] === '\r') {
          return false;
        } else {
          i++;
        }
      }
      return false;
    }

    function parseNum() {
      const start = i;
      if (text[i] === '-') i++;
      while (i < len && /[0-9]/.test(text[i])) i++;
      if (i < len && text[i] === '.') {
        i++;
        while (i < len && /[0-9]/.test(text[i])) i++;
      }
      if (i < len && (text[i] === 'e' || text[i] === 'E')) {
        i++;
        if (text[i] === '+' || text[i] === '-') i++;
        while (i < len && /[0-9]/.test(text[i])) i++;
      }
      return i > start;
    }

    function parseObj() {
      i++; // skip {
      skipWs();
      if (i < len && text[i] === '}') { i++; return true; }
      while (i < len) {
        skipWs();
        if (text[i] !== '"') return false;
        if (!parseStr()) return false;
        skipWs();
        if (text[i] !== ':') return false;
        i++; // skip :
        if (!parseVal()) return false;
        skipWs();
        if (text[i] === '}') { i++; return true; }
        if (text[i] !== ',') return false;
        i++; // skip ,
      }
      return false;
    }

    function parseArr() {
      i++; // skip [
      skipWs();
      if (i < len && text[i] === ']') { i++; return true; }
      while (i < len) {
        if (!parseVal()) return false;
        skipWs();
        if (text[i] === ']') { i++; return true; }
        if (text[i] !== ',') return false;
        i++; // skip ,
      }
      return false;
    }

    parseVal();
    skipWs();
    return i;
  }

  function locateJsonError(text, errMessage) {
    // 1. Explicit line/col in message (Firefox or newer V8)
    const lineColMatch = errMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColMatch) {
      const line = parseInt(lineColMatch[1], 10);
      const col = parseInt(lineColMatch[2], 10);
      return { line, column: col };
    }

    // 2. Position offset in message (Standard V8)
    const posMatch = errMessage.match(/position\s+(\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      return positionToLineCol(text, pos);
    }

    // 3. Fallback: character scanner
    const index = scanJsonErrorIndex(text);
    return positionToLineCol(text, index);
  }

  function parse(text, options) {
    if (text === null || text === undefined || typeof text !== 'string') {
      return { success: false, error: { message: 'Input must be a valid string', line: 1, column: 1, snippet: '' } };
    }
    const trimmed = text.trim();
    if (trimmed === '') {
      return { success: true, data: {} };
    }

    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch (err) {
      const msg = err.message || 'JSON Syntax Error';
      const loc = locateJsonError(text, msg);
      const snippet = generateSnippet(text, loc.line, loc.column);
      return {
        success: false,
        error: {
          message: msg,
          line: loc.line,
          column: loc.column,
          snippet: snippet
        }
      };
    }
  }

  function stringify(data, options) {
    try {
      if (data === undefined) {
        return { success: true, text: '' };
      }

      options = options || {};
      let space = 2;
      if (options.indent !== undefined) {
        if (options.indent === 'compact' || options.indent === 0 || options.indent === false) {
          space = undefined;
        } else if (options.indent === 'tab' || options.indent === '\t') {
          space = '\t';
        } else if (typeof options.indent === 'number') {
          space = options.indent;
        }
      }

      // Visited set to catch circular references gracefully
      const seen = new WeakSet();
      const replacer = (key, value) => {
        if (typeof value === 'bigint') {
          return Number(value);
        }
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            throw new Error('Circular reference detected in data structure');
          }
          seen.add(value);
        }
        return value;
      };

      const text = JSON.stringify(data, replacer, space);
      return { success: true, text: text !== undefined ? text : 'null' };
    } catch (err) {
      return {
        success: false,
        error: {
          message: err.message || 'Failed to stringify JSON'
        }
      };
    }
  }

  return { parse, stringify };
});

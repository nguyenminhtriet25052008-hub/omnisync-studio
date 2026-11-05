/**
 * OmniSync Data Studio - RFC 4180 CSV Parser & Serializer
 * Auto-Delimiter Detection, UTF-8 BOM Stripping, and Dot-Notation Flattening/Unflattening
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.parsers = root.OmniSync.parsers || {};
    root.OmniSync.parsers.csv = factory();
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

  function detectDelimiter(text) {
    const candidates = [',', ';', '\t', '|'];
    const lines = text.split(/\r?\n/).slice(0, 5);
    const sample = lines.join('\n');
    let best = ',';
    let maxCount = -1;

    for (const c of candidates) {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === '"') {
          inQuotes = !inQuotes;
        } else if (!inQuotes && sample[i] === c) {
          count++;
        }
      }
      if (count > maxCount) {
        maxCount = count;
        best = c;
      }
    }
    return best;
  }

  function flattenObject(obj, prefix, res) {
    prefix = prefix || '';
    res = res || {};

    if (obj === null || typeof obj !== 'object') {
      res[prefix] = obj;
      return res;
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        res[prefix] = '';
      } else {
        for (let i = 0; i < obj.length; i++) {
          const nextKey = prefix ? prefix + '.' + i : String(i);
          flattenObject(obj[i], nextKey, res);
        }
      }
      return res;
    }

    const keys = Object.keys(obj);
    if (keys.length === 0 && prefix) {
      res[prefix] = '';
      return res;
    }

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (isUnsafeKey(k)) continue;
      const nextKey = prefix ? prefix + '.' + k : k;
      flattenObject(obj[k], nextKey, res);
    }

    return res;
  }

  function inferValue(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;

    // Preserve leading zeros for strings like "0123" unless it's "0" or "0.xyz"
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
      if ((trimmed.startsWith('0') && trimmed.length > 1 && !trimmed.startsWith('0.')) ||
          (trimmed.startsWith('-0') && trimmed.length > 2 && !trimmed.startsWith('-0.'))) {
        return trimmed;
      }
      const num = Number(trimmed);
      if (!isNaN(num)) return num;
    }
    return val;
  }

  function isUnsafeKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  function unflattenObject(flat, inferTypes) {
    const root = {};
    const paths = Object.keys(flat);

    for (let p = 0; p < paths.length; p++) {
      const path = paths[p];
      const val = flat[path];
      const parts = path.split('.');

      if (parts.some(isUnsafeKey)) {
        continue;
      }

      let curr = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextPart = parts[i + 1];
        const isNextNum = /^\d+$/.test(nextPart);

        if (!Object.prototype.hasOwnProperty.call(curr, part) || curr[part] === null || typeof curr[part] !== 'object') {
          curr[part] = isNextNum ? [] : {};
        }
        curr = curr[part];
      }

      const lastPart = parts[parts.length - 1];
      curr[lastPart] = inferTypes ? inferValue(val) : (val === '' ? null : val);
    }
    return root;
  }

  function parse(text, options) {
    if (text === null || text === undefined || typeof text !== 'string') {
      return { success: false, error: { message: 'Input must be a valid string', line: 1, column: 1, snippet: '' } };
    }

    // UTF-8 BOM check
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    if (text.trim() === '') {
      return { success: true, data: [] };
    }

    options = options || {};
    const delimiter = options.delimiter || detectDelimiter(text);
    const inferTypes = options.inferTypes !== false;

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let quoteStartLine = 1;
    let quoteStartCol = 1;

    let line = 1;
    let col = 1;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            currentField += '"';
            i += 2;
            col += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            col++;
            continue;
          }
        } else {
          currentField += ch;
          if (ch === '\n') {
            line++;
            col = 1;
          } else if (ch !== '\r') {
            col++;
          }
          i++;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          quoteStartLine = line;
          quoteStartCol = col;
          i++;
          col++;
          continue;
        }

        if (ch === delimiter) {
          currentRow.push(currentField);
          currentField = '';
          i++;
          col++;
          continue;
        }

        if (ch === '\r') {
          if (i + 1 < len && text[i + 1] === '\n') {
            i++;
          }
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          line++;
          col = 1;
          i++;
          continue;
        }

        if (ch === '\n') {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          line++;
          col = 1;
          i++;
          continue;
        }

        currentField += ch;
        col++;
        i++;
      }
    }

    if (inQuotes) {
      return {
        success: false,
        error: {
          message: 'Unclosed quote in CSV input',
          line: quoteStartLine,
          column: quoteStartCol,
          snippet: generateSnippet(text, quoteStartLine, quoteStartCol)
        }
      };
    }

    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    if (rows.length === 0) {
      return { success: true, data: [] };
    }

    // First row is headers
    const rawHeaders = rows[0];
    const headers = rawHeaders.map(h => h.trim());

    const result = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      // Skip trailing empty row
      if (row.length === 1 && row[0] === '' && r === rows.length - 1) continue;

      const flatRecord = {};
      for (let c = 0; c < headers.length; c++) {
        const header = headers[c];
        const val = c < row.length ? row[c] : '';
        flatRecord[header] = val;
      }
      result.push(unflattenObject(flatRecord, inferTypes));
    }

    return { success: true, data: result };
  }

  function formatCsvCell(cellStr, delimiter) {
    if (typeof cellStr !== 'string') {
      cellStr = cellStr === null || cellStr === undefined ? '' : String(cellStr);
    }
    if (cellStr.includes(delimiter) || cellStr.includes('\n') || cellStr.includes('\r') || cellStr.includes('"')) {
      return '"' + cellStr.replace(/"/g, '""') + '"';
    }
    return cellStr;
  }

  function stringify(data, options) {
    try {
      if (data === null || data === undefined) {
        return { success: true, text: '' };
      }

      options = options || {};
      const delimiter = options.delimiter || ',';

      let records = [];
      if (Array.isArray(data)) {
        if (data.length === 0) return { success: true, text: '' };
        if (typeof data[0] !== 'object' || data[0] === null) {
          records = data.map(item => ({ value: item }));
        } else {
          records = data;
        }
      } else if (typeof data === 'object') {
        records = [data];
      } else {
        records = [{ value: data }];
      }

      // Flatten each record
      const flatRecords = records.map(r => flattenObject(r));

      // Superset header collection in discovery order
      const headerSet = new Set();
      for (let i = 0; i < flatRecords.length; i++) {
        const keys = Object.keys(flatRecords[i]);
        for (let k = 0; k < keys.length; k++) {
          headerSet.add(keys[k]);
        }
      }
      const headers = Array.from(headerSet);

      if (headers.length === 0) {
        return { success: true, text: '' };
      }

      const lines = [];
      // Header row
      lines.push(headers.map(h => formatCsvCell(h, delimiter)).join(delimiter));

      // Data rows
      for (let i = 0; i < flatRecords.length; i++) {
        const rec = flatRecords[i];
        const row = headers.map(h => {
          const val = rec[h];
          if (val === null || val === undefined) return '';
          return formatCsvCell(String(val), delimiter);
        });
        lines.push(row.join(delimiter));
      }

      return { success: true, text: lines.join('\r\n') };
    } catch (err) {
      return { success: false, error: { message: err.message || 'Failed to serialize CSV' } };
    }
  }

  return { parse, stringify };
});

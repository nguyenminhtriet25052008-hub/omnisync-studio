/**
 * OmniSync Data Studio - Pure JS YAML Parser & Serializer
 * Zero-Dependency YAML 1.2 Core Subset with Quote Safety & Indentation Diagnostics
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.parsers = root.OmniSync.parsers || {};
    root.OmniSync.parsers.yaml = factory();
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

  function stripInlineComment(str) {
    let inDouble = false;
    let inSingle = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && !inSingle && (i === 0 || str[i - 1] !== '\\')) inDouble = !inDouble;
      else if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '#' && !inDouble && !inSingle) {
        if (i === 0 || /\s/.test(str[i - 1])) {
          return str.slice(0, i).trimEnd();
        }
      }
    }
    return str;
  }

  function parseScalar(str) {
    str = str.trim();
    if (str === '' || str === '~' || str === 'null' || str === 'Null' || str === 'NULL') return null;
    if (/^(true|True|TRUE|yes|Yes|YES|on|On|ON)$/.test(str)) return true;
    if (/^(false|False|FALSE|no|No|NO|off|Off|OFF)$/.test(str)) return false;

    // Numbers
    if (/^0x[0-9a-fA-F]+$/.test(str)) return parseInt(str, 16);
    if (/^0o[0-7]+$/.test(str)) return parseInt(str.slice(2), 8);
    if (/^[-+]?\d+$/.test(str)) return parseInt(str, 10);
    if (/^[-+]?(\d+\.\d+|\.\d+|\d+\.)([eE][-+]?\d+)?$/.test(str) || /^[-+]?\d+[eE][-+]?\d+$/.test(str)) {
      return parseFloat(str);
    }

    // Quoted strings
    if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
      try {
        return JSON.parse(str);
      } catch (_) {
        return str.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }
    if (str.startsWith("'") && str.endsWith("'") && str.length >= 2) {
      return str.slice(1, -1).replace(/''/g, "'");
    }

    // Flow array [1, 2, 3]
    if (str.startsWith('[') && str.endsWith(']')) {
      try { return JSON.parse(str); } catch (_) {}
    }
    // Flow object { a: 1 }
    if (str.startsWith('{') && str.endsWith('}')) {
      try { return JSON.parse(str); } catch (_) {}
    }

    return str;
  }

  function findColonIndex(str) {
    let inDouble = false;
    let inSingle = false;
    let quoteEnd = -1;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inDouble) {
        if (ch === '\\') {
          i++; // skip escaped char inside double quotes
        } else if (ch === '"') {
          inDouble = false;
          quoteEnd = i;
        }
      } else if (inSingle) {
        if (ch === "'") {
          if (i + 1 < str.length && str[i + 1] === "'") {
            i++; // escaped single quote '' inside single quotes
          } else {
            inSingle = false;
            quoteEnd = i;
          }
        }
      } else {
        if (ch === '"') {
          inDouble = true;
        } else if (ch === "'") {
          inSingle = true;
        } else if (ch === ':') {
          const afterColon = (i + 1 >= str.length) || str[i + 1] === ' ' || str[i + 1] === '\t';
          const isQuotedKey = quoteEnd !== -1 && str.slice(quoteEnd + 1, i).trim() === '';
          if (afterColon || isQuotedKey) {
            const prefix = str.slice(0, i).trim();
            if (prefix.length > 0) return i;
          }
        }
      }
    }
    return -1;
  }

  function unquoteKey(key) {
    key = key.trim();
    if (key.startsWith('"') && key.endsWith('"') && key.length >= 2) {
      try {
        return JSON.parse(key);
      } catch (_) {
        return key.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }
    if (key.startsWith("'") && key.endsWith("'") && key.length >= 2) {
      return key.slice(1, -1).replace(/''/g, "'");
    }
    return key;
  }

  function isKeyValue(str) {
    return findColonIndex(str) !== -1;
  }

  function parseKv(str) {
    const colonIdx = findColonIndex(str);
    if (colonIdx === -1) {
      return {
        key: str.trim(),
        hasVal: false,
        val: ''
      };
    }
    const rawKey = str.slice(0, colonIdx);
    const key = unquoteKey(rawKey);
    const rem = str.slice(colonIdx + 1).trim();
    return {
      key: key,
      hasVal: rem !== '',
      val: rem
    };
  }

  function parse(text, options) {
    if (text === null || text === undefined || typeof text !== 'string') {
      return { success: false, error: { message: 'Input must be a valid string', line: 1, column: 1, snippet: '' } };
    }
    const trimmed = text.trim();
    if (trimmed === '') {
      return { success: true, data: {} };
    }

    const rawLines = text.split(/\r?\n/);

    // 1. Tab check in indentation
    for (let idx = 0; idx < rawLines.length; idx++) {
      const l = rawLines[idx];
      const match = l.match(/^(\s*)\t/);
      if (match) {
        const col = match[1].length + 1;
        const line = idx + 1;
        return {
          success: false,
          error: {
            message: 'YAML forbids tabs for indentation; use spaces.',
            line: line,
            column: col,
            snippet: generateSnippet(text, line, col)
          }
        };
      }
    }

    // 2. Preprocess lines: filter full comments and empty lines, record 1-based line numbers
    const lines = [];
    for (let idx = 0; idx < rawLines.length; idx++) {
      const raw = rawLines[idx];
      const stripped = stripInlineComment(raw);
      const firstNonWs = stripped.search(/\S/);
      if (firstNonWs === -1) continue; // empty line
      lines.push({
        lineNum: idx + 1,
        indent: firstNonWs,
        text: stripped.slice(firstNonWs)
      });
    }

    if (lines.length === 0) {
      return { success: true, data: {} };
    }

    // Check single scalar document
    if (lines.length === 1 && !isKeyValue(lines[0].text) && !lines[0].text.startsWith('- ') && lines[0].text !== '-') {
      return { success: true, data: parseScalar(lines[0].text) };
    }

    let ptr = 0;

    function parseBlock(currentIndent) {
      if (ptr >= lines.length) return null;
      const head = lines[ptr];

      if (head.text.startsWith('- ') || head.text === '-') {
        // Sequence List
        const list = [];
        while (ptr < lines.length) {
          const cur = lines[ptr];
          if (cur.indent < currentIndent) break;
          if (cur.indent > currentIndent) break;
          if (!cur.text.startsWith('- ') && cur.text !== '-') break;

          const itemStr = cur.text.startsWith('- ') ? cur.text.slice(2).trim() : '';
          ptr++;

          if (itemStr === '') {
            // Nested block below
            if (ptr < lines.length && lines[ptr].indent > cur.indent) {
              list.push(parseBlock(lines[ptr].indent));
            } else {
              list.push(null);
            }
          } else if (isKeyValue(itemStr)) {
            // Hybrid map inside list item: - key: val
            const map = {};
            const kv = parseKv(itemStr);
            if (!kv.hasVal) {
              if (ptr < lines.length && lines[ptr].indent > cur.indent + 2) {
                map[kv.key] = parseBlock(lines[ptr].indent);
              } else {
                map[kv.key] = null;
              }
            } else {
              map[kv.key] = parseScalar(kv.val);
            }

            const mapIndent = cur.indent + 2;
            while (ptr < lines.length && lines[ptr].indent === mapIndent && isKeyValue(lines[ptr].text)) {
              const nextKv = parseKv(lines[ptr].text);
              ptr++;
              if (!nextKv.hasVal) {
                if (ptr < lines.length && lines[ptr].indent > mapIndent) {
                  map[nextKv.key] = parseBlock(lines[ptr].indent);
                } else {
                  map[nextKv.key] = null;
                }
              } else {
                map[nextKv.key] = parseScalar(nextKv.val);
              }
            }
            list.push(map);
          } else {
            list.push(parseScalar(itemStr));
          }
        }
        return list;
      } else {
        // Mapping Object
        const obj = {};
        while (ptr < lines.length) {
          const cur = lines[ptr];
          if (cur.indent < currentIndent) break;
          if (cur.indent > currentIndent) break;

          if (!isKeyValue(cur.text)) {
            ptr++;
            continue;
          }

          const kv = parseKv(cur.text);
          ptr++;

          if (kv.val === '|' || kv.val === '|-') {
            // Literal block scalar
            const blockIndent = ptr < lines.length ? lines[ptr].indent : currentIndent + 2;
            const blockLines = [];
            while (ptr < lines.length && lines[ptr].indent >= blockIndent) {
              const origLine = rawLines[lines[ptr].lineNum - 1];
              blockLines.push(origLine.slice(blockIndent));
              ptr++;
            }
            obj[kv.key] = blockLines.join('\n');
          } else if (kv.val === '>' || kv.val === '>-') {
            // Folded block scalar
            const blockIndent = ptr < lines.length ? lines[ptr].indent : currentIndent + 2;
            const blockLines = [];
            while (ptr < lines.length && lines[ptr].indent >= blockIndent) {
              const origLine = rawLines[lines[ptr].lineNum - 1];
              blockLines.push(origLine.slice(blockIndent).trim());
              ptr++;
            }
            obj[kv.key] = blockLines.join(' ');
          } else if (!kv.hasVal) {
            // Nested block
            if (ptr < lines.length && lines[ptr].indent > cur.indent) {
              obj[kv.key] = parseBlock(lines[ptr].indent);
            } else {
              obj[kv.key] = null;
            }
          } else {
            obj[kv.key] = parseScalar(kv.val);
          }
        }
        return obj;
      }
    }

    try {
      const result = parseBlock(lines[0].indent);
      return { success: true, data: result !== null ? result : {} };
    } catch (err) {
      const errLine = ptr < lines.length ? lines[ptr].lineNum : 1;
      const errCol = ptr < lines.length ? lines[ptr].indent + 1 : 1;
      return {
        success: false,
        error: {
          message: err.message || 'YAML parsing error',
          line: errLine,
          column: errCol,
          snippet: generateSnippet(text, errLine, errCol)
        }
      };
    }
  }

  function formatYamlString(str) {
    if (str === '') return "''";
    const isSpecialLiteral = /^(true|false|yes|no|on|off|null|~|\.nan|\.inf|-?\d+(\.\d+)?([eE][+-]?\d+)?|0x[0-9a-fA-F]+)$/i.test(str);
    const hasSpecialChars = /[\n\r\t:#[\]{},&*!|>'\"%@`]/.test(str) || /^\s|\s$/.test(str) || str.startsWith('- ');
    if (isSpecialLiteral || hasSpecialChars) {
      return JSON.stringify(str);
    }
    return str;
  }

  function formatYamlKey(key) {
    if (/^[a-zA-Z0-9_\-]+$/.test(key)) return key;
    return JSON.stringify(key);
  }

  function stringify(data, options) {
    try {
      if (data === undefined) return { success: true, text: '' };

      function emit(val, indentLevel) {
        const indent = '  '.repeat(indentLevel);

        if (val === null) return 'null';
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        if (typeof val === 'number') return String(val);
        if (typeof val === 'string') {
          if (val.includes('\n')) {
            const lines = val.split('\n').map(l => indent + '  ' + l).join('\n');
            return '|\n' + lines;
          }
          return formatYamlString(val);
        }

        if (Array.isArray(val)) {
          if (val.length === 0) return '[]';
          const items = [];
          for (let i = 0; i < val.length; i++) {
            const item = val[i];
            if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
              const keys = Object.keys(item);
              if (keys.length === 0) {
                items.push(indent + '- {}');
              } else {
                const firstKey = keys[0];
                const firstVal = emit(item[firstKey], indentLevel + 2);
                if (typeof item[firstKey] === 'object' && item[firstKey] !== null) {
                  items.push(indent + '- ' + formatYamlKey(firstKey) + ':');
                  items.push(emit(item[firstKey], indentLevel + 2));
                } else if (firstVal.startsWith('|\n')) {
                  items.push(indent + '- ' + formatYamlKey(firstKey) + ': ' + firstVal);
                } else {
                  items.push(indent + '- ' + formatYamlKey(firstKey) + ': ' + firstVal);
                }

                for (let k = 1; k < keys.length; k++) {
                  const key = keys[k];
                  const subVal = emit(item[key], indentLevel + 2);
                  if (typeof item[key] === 'object' && item[key] !== null) {
                    items.push(indent + '  ' + formatYamlKey(key) + ':');
                    items.push(emit(item[key], indentLevel + 2));
                  } else {
                    items.push(indent + '  ' + formatYamlKey(key) + ': ' + subVal);
                  }
                }
              }
            } else {
              items.push(indent + '- ' + emit(item, indentLevel + 1));
            }
          }
          return items.join('\n');
        }

        if (typeof val === 'object') {
          const keys = Object.keys(val);
          if (keys.length === 0) return '{}';
          const entries = [];
          for (const k of keys) {
            const v = val[k];
            const formattedKey = formatYamlKey(k);
            if (Array.isArray(v)) {
              if (v.length === 0) {
                entries.push(indent + formattedKey + ': []');
              } else {
                entries.push(indent + formattedKey + ':\n' + emit(v, indentLevel + 1));
              }
            } else if (typeof v === 'object' && v !== null) {
              if (Object.keys(v).length === 0) {
                entries.push(indent + formattedKey + ': {}');
              } else {
                entries.push(indent + formattedKey + ':\n' + emit(v, indentLevel + 1));
              }
            } else {
              const formattedVal = emit(v, indentLevel);
              entries.push(indent + formattedKey + ': ' + formattedVal);
            }
          }
          return entries.join('\n');
        }

        return String(val);
      }

      const text = emit(data, 0).trim();
      return { success: true, text: text };
    } catch (err) {
      return { success: false, error: { message: err.message || 'Failed to serialize YAML' } };
    }
  }

  return { parse, stringify };
});

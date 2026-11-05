/**
 * OmniSync Data Studio - XML Parser & Serializer
 * Zero-dependency universal XML engine with BadgerFish IR mapping.
 * Compatible with Node.js and Browser environments.
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const mod = factory();
    module.exports = mod;
    module.exports.XMLParser = mod;
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.parsers = root.OmniSync.parsers || {};
    const mod = factory();
    root.OmniSync.parsers.xml = mod;
    root.XMLParser = mod;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // XML Entity maps
  const ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'"
  };

  const REVERSE_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };

  function decodeEntities(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, function (match, entity) {
      if (ENTITIES[match]) return ENTITIES[match];
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        return String.fromCharCode(parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith('#')) {
        return String.fromCharCode(parseInt(entity.slice(1), 10));
      }
      return match;
    });
  }

  function escapeXmlText(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>]/g, function (ch) {
      return REVERSE_ENTITIES[ch];
    });
  }

  function escapeXmlAttr(str) {
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<"]/g, function (ch) {
      return REVERSE_ENTITIES[ch];
    });
  }

  function sanitizeTagName(name) {
    let safe = String(name).replace(/[^a-zA-Z0-9_.:-]/g, '_');
    if (/^[0-9.:-]/.test(safe)) {
      safe = '_' + safe;
    }
    return safe || 'item';
  }

  function inferValue(val, inferTypes) {
    if (inferTypes === false || typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;

    if (/^-?\d+$/.test(trimmed)) {
      if ((trimmed.startsWith('0') && trimmed.length > 1) || (trimmed.startsWith('-0') && trimmed.length > 2)) {
        return trimmed;
      }
      const num = Number(trimmed);
      if (Number.isSafeInteger(num)) return num;
    }
    if (/^-?\d+\.\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num)) return num;
    }
    return val;
  }

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

  function finalizeBadgerFishNode(node, inferTypes, trimWhitespace) {
    const hasAttrs = Object.keys(node.attributes).length > 0;
    const hasChildren = node.children.length > 0;

    // Combine raw text and CDATA parts
    let combinedText = '';
    if (node.rawText) {
      let t = decodeEntities(node.rawText);
      if (trimWhitespace) t = t.trim();
      if (t) combinedText += t;
    }
    if (node.cdataParts.length > 0) {
      combinedText += node.cdataParts.join('');
    }

    const hasText = combinedText.length > 0;
    const textVal = hasText ? inferValue(combinedText, inferTypes) : null;

    // Case 1: Simple leaf node with only text
    if (!hasAttrs && !hasChildren) {
      return hasText ? textVal : null;
    }

    const result = { ...node.attributes };

    // Case 2: Node with children (aggregate repeated sibling tags into Arrays)
    if (hasChildren) {
      const groups = {};
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (!groups[child.tag]) groups[child.tag] = [];
        groups[child.tag].push(child.value);
      }
      const groupKeys = Object.keys(groups);
      for (let k = 0; k < groupKeys.length; k++) {
        const tag = groupKeys[k];
        const items = groups[tag];
        result[tag] = items.length === 1 ? items[0] : items;
      }
    }

    // Case 3: Mixed content or text alongside attributes
    if (hasText) {
      result['#text'] = textVal;
    }

    return result;
  }

  function parse(text, options) {
    if (text === null || text === undefined || typeof text !== 'string') {
      return { success: false, error: { message: 'Input must be a valid string', line: 1, column: 1, snippet: '' } };
    }

    const trimmed = text.trim();
    if (trimmed === '') {
      return { success: true, data: {} };
    }

    options = options || {};
    const inferTypes = options.inferTypes !== false;
    const trimWhitespace = options.trimWhitespace !== false;

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

    const stack = [];
    let rootNode = null;

    while (index < len) {
      const nextLt = text.indexOf('<', index);

      if (nextLt === -1) {
        // Remaining trailing text
        const trailing = text.slice(index);
        if (trailing.trim() && stack.length === 0) {
          return errorAt(index, 'Extra content after document root');
        }
        break;
      }

      // Text between tags
      if (nextLt > index && stack.length > 0) {
        const charData = text.slice(index, nextLt);
        stack[stack.length - 1].rawText += charData;
      }

      index = nextLt;

      // Comments: <!-- ... -->
      if (text.startsWith('<!--', index)) {
        const endComment = text.indexOf('-->', index + 4);
        if (endComment === -1) {
          return errorAt(index, 'Unclosed XML comment');
        }
        index = endComment + 3;
        continue;
      }

      // CDATA: <![CDATA[ ... ]]>
      if (text.startsWith('<![CDATA[', index)) {
        if (stack.length === 0) {
          return errorAt(index, 'CDATA section outside of root element');
        }
        const endCdata = text.indexOf(']]>', index + 9);
        if (endCdata === -1) {
          return errorAt(index, 'Unclosed CDATA section');
        }
        const cdataText = text.slice(index + 9, endCdata);
        stack[stack.length - 1].cdataParts.push(cdataText);
        index = endCdata + 3;
        continue;
      }

      // Processing Instructions or XML Declaration: <? ... ?>
      if (text.startsWith('<?', index)) {
        const endPi = text.indexOf('?>', index + 2);
        if (endPi === -1) {
          return errorAt(index, 'Unclosed processing instruction or XML declaration');
        }
        index = endPi + 2;
        continue;
      }

      // DOCTYPE: <!DOCTYPE ... >
      if (text.startsWith('<!', index)) {
        let depth = 1;
        let i = index + 2;
        while (i < len && depth > 0) {
          if (text[i] === '<') depth++;
          else if (text[i] === '>') depth--;
          i++;
        }
        if (depth !== 0) {
          return errorAt(index, 'Unclosed <!DOCTYPE directive');
        }
        index = i;
        continue;
      }

      // Closing Tag: </tag>
      if (text.startsWith('</', index)) {
        const tagClosePos = text.indexOf('>', index + 2);
        if (tagClosePos === -1) {
          return errorAt(index, 'Unclosed closing tag');
        }
        const closeTagName = text.slice(index + 2, tagClosePos).trim();
        if (stack.length === 0) {
          return errorAt(index, `Unexpected closing tag </${closeTagName}> without matching open tag`);
        }
        const current = stack.pop();
        if (current.tag !== closeTagName) {
          return errorAt(index, `Mismatched closing tag: expected </${current.tag}>, found </${closeTagName}>`);
        }

        const finalizedValue = finalizeBadgerFishNode(current, inferTypes, trimWhitespace);

        if (stack.length > 0) {
          stack[stack.length - 1].children.push({ tag: current.tag, value: finalizedValue });
        } else {
          if (rootNode !== null) {
            return errorAt(index, 'Multiple root elements found in XML document');
          }
          rootNode = { [current.tag]: finalizedValue };
        }

        index = tagClosePos + 1;
        continue;
      }

      // Opening Tag or Self-Closing Tag: <tag ... >
      const openTagMatch = /^<([a-zA-Z_][a-zA-Z0-9_.:-]*)/.exec(text.slice(index));
      if (!openTagMatch) {
        return errorAt(index, 'Invalid XML tag format');
      }

      const tagName = openTagMatch[1];
      let tagCursor = index + openTagMatch[0].length;
      const attributes = {};
      let isSelfClosing = false;

      // Parse attributes
      while (tagCursor < len) {
        while (tagCursor < len && /\s/.test(text[tagCursor])) tagCursor++;

        if (tagCursor >= len) break;

        if (text[tagCursor] === '>') {
          tagCursor++;
          break;
        }
        if (text.startsWith('/>', tagCursor)) {
          isSelfClosing = true;
          tagCursor += 2;
          break;
        }

        const attrMatch = /^([a-zA-Z_][a-zA-Z0-9_.:-]*)\s*=\s*/.exec(text.slice(tagCursor));
        if (!attrMatch) {
          return errorAt(tagCursor, `Malformed attribute in tag <${tagName}>`);
        }

        const attrName = attrMatch[1];
        tagCursor += attrMatch[0].length;

        if (tagCursor >= len) {
          return errorAt(tagCursor, `Unexpected EOF in attribute value for <${tagName}>`);
        }

        const quoteChar = text[tagCursor];
        if (quoteChar !== '"' && quoteChar !== "'") {
          return errorAt(tagCursor, `Attribute value must be quoted for attribute "${attrName}"`);
        }

        tagCursor++;
        const endQuote = text.indexOf(quoteChar, tagCursor);
        if (endQuote === -1) {
          return errorAt(tagCursor, `Unclosed quote in attribute "${attrName}"`);
        }

        const rawAttrVal = text.slice(tagCursor, endQuote);
        attributes['@' + attrName] = inferValue(decodeEntities(rawAttrVal), inferTypes);
        tagCursor = endQuote + 1;
      }

      const node = {
        tag: tagName,
        openPos: index,
        attributes,
        children: [],
        rawText: '',
        cdataParts: []
      };

      if (isSelfClosing) {
        const finalized = finalizeBadgerFishNode(node, inferTypes, trimWhitespace);
        if (stack.length > 0) {
          stack[stack.length - 1].children.push({ tag: tagName, value: finalized });
        } else {
          if (rootNode !== null) {
            return errorAt(index, 'Multiple root elements found in XML document');
          }
          rootNode = { [tagName]: finalized };
        }
      } else {
        stack.push(node);
      }

      index = tagCursor;
    }

    if (stack.length > 0) {
      const unclosed = stack[stack.length - 1];
      return errorAt(unclosed.openPos, `Unclosed XML tag <${unclosed.tag}>`);
    }

    if (!rootNode) {
      return { success: true, data: {} };
    }

    return {
      success: true,
      data: rootNode
    };
  }

  function stringify(data, options) {
    try {
      if (data === null || data === undefined) {
        return { success: true, text: '' };
      }

      options = options || {};
      const indentChar = typeof options.indent === 'string'
        ? options.indent
        : (typeof options.indent === 'number' ? ' '.repeat(options.indent) : '  ');
      const syntheticRoot = options.syntheticRoot || 'root';
      const declaration = options.xmlDeclaration !== false;
      const selfCloseEmpty = options.selfCloseEmpty !== false;

      let target = data;

      // Synthetic Root Wrapping
      if (Array.isArray(target)) {
        target = { [syntheticRoot]: { item: target } };
      } else if (typeof target !== 'object' || target === null) {
        target = { [syntheticRoot]: target };
      } else {
        const allKeys = Object.keys(target);
        const hasTopLevelMeta = allKeys.some(k => k.startsWith('@') || k === '#text');
        const topKeys = allKeys.filter(k => !k.startsWith('@') && k !== '#text');
        if (topKeys.length !== 1 || Array.isArray(target[topKeys[0]]) || hasTopLevelMeta) {
          target = { [syntheticRoot]: target };
        }
      }

      function serializeElement(tag, value, depth) {
        const safeTag = sanitizeTagName(tag);
        const curIndent = indentChar ? indentChar.repeat(depth) : '';
        const nl = indentChar ? '\n' : '';

        if (value === null || value === undefined) {
          return selfCloseEmpty ? `${curIndent}<${safeTag}/>${nl}` : `${curIndent}<${safeTag}></${safeTag}>${nl}`;
        }

        if (typeof value !== 'object') {
          const textContent = escapeXmlText(String(value));
          return `${curIndent}<${safeTag}>${textContent}</${safeTag}>${nl}`;
        }

        if (Array.isArray(value)) {
          return value.map(item => serializeElement(tag, item, depth)).join('');
        }

        // Extract attributes, text, and children
        const attrs = [];
        let textContent = null;
        const children = [];

        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const v = value[k];
          if (k.startsWith('@')) {
            attrs.push(` ${sanitizeTagName(k.slice(1))}="${escapeXmlAttr(String(v))}"`);
          } else if (k === '#text' || k === '$') {
            textContent = String(v);
          } else {
            children.push([k, v]);
          }
        }

        const attrStr = attrs.join('');

        if (children.length === 0 && textContent === null) {
          return selfCloseEmpty ? `${curIndent}<${safeTag}${attrStr}/>${nl}` : `${curIndent}<${safeTag}${attrStr}></${safeTag}>${nl}`;
        }

        if (children.length === 0 && textContent !== null) {
          return `${curIndent}<${safeTag}${attrStr}>${escapeXmlText(textContent)}</${safeTag}>${nl}`;
        }

        let inner = '';
        if (textContent !== null) {
          inner += `${curIndent}${indentChar}${escapeXmlText(textContent)}${nl}`;
        }
        for (let i = 0; i < children.length; i++) {
          const cTag = children[i][0];
          const cVal = children[i][1];
          inner += serializeElement(cTag, cVal, depth + 1);
        }

        return `${curIndent}<${safeTag}${attrStr}>${nl}${inner}${curIndent}</${safeTag}>${nl}`;
      }

      const rootKey = Object.keys(target)[0];
      let xml = serializeElement(rootKey, target[rootKey], 0);

      if (declaration) {
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
      }

      return {
        success: true,
        text: xml.trim()
      };
    } catch (err) {
      return {
        success: false,
        error: { message: err.message || 'Failed to serialize XML' }
      };
    }
  }

  return { parse, stringify };
});

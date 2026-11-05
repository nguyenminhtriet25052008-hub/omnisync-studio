/**
 * js/engine/ir.js - Canonical Intermediate Representation Normalizer & Value Graph Engine
 * OmniSync Studio - Browser & Node.js Isomorphic Module
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const mod = factory();
    module.exports = mod;
    module.exports.IR = mod;
  } else {
    root.OmniSync = root.OmniSync || {};
    const mod = factory();
    root.OmniSync.IR = mod;
    root.IR = mod;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  function isUnsafeKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  const IR = {
    /**
     * Determines whether a value is a primitive (string, number, boolean, null)
     */
    isPrimitive: function (val) {
      return val === null || (typeof val !== 'object' && typeof val !== 'function' && typeof val !== 'bigint');
    },

    /**
     * Deeply normalizes an arbitrary JavaScript value into Canonical IR.
     * @param {any} val - Input data
     * @param {object} [options] - Normalization options
     * @param {boolean} [options.sortKeys=false] - Sort object keys alphabetically
     * @param {boolean} [options.stripUndefined=true] - Remove undefined object keys
     * @param {WeakSet} [visited] - Internal circular reference tracker
     * @returns {any} Normalized Canonical IR
     */
    normalize: function (val, options, visited) {
      options = options || {};
      visited = visited || new WeakSet();
      const sortKeys = options.sortKeys === true;
      const stripUndefined = options.stripUndefined !== false;

      if (val === undefined) {
        return null;
      }

      if (typeof val === 'bigint') {
        return val <= BigInt(Number.MAX_SAFE_INTEGER) && val >= BigInt(Number.MIN_SAFE_INTEGER)
          ? Number(val)
          : val.toString();
      }

      if (this.isPrimitive(val)) {
        if (typeof val === 'number') {
          return Number.isFinite(val) ? val : null;
        }
        return val;
      }

      if (val instanceof Date) {
        return isNaN(val.getTime()) ? null : val.toISOString();
      }

      // Detect circular reference
      if (visited.has(val)) {
        return '[Circular]';
      }
      visited.add(val);

      if (Array.isArray(val)) {
        const outArr = [];
        for (let i = 0; i < val.length; i++) {
          outArr.push(this.normalize(val[i], options, visited));
        }
        return outArr;
      }

      if (typeof val === 'object') {
        const outObj = {};
        let keys = Object.keys(val);
        if (sortKeys) {
          keys.sort();
        }
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const v = val[k];
          if (v === undefined && stripUndefined) {
            continue;
          }
          outObj[k] = this.normalize(v, options, visited);
        }
        return outObj;
      }

      // Functions, symbols, etc. normalized to null
      return null;
    },

    /**
     * High-performance semantic deep equality check.
     * Invariant: Independent of key ordering in objects.
     */
    deepEquals: function (a, b) {
      if (Object.is(a, b)) return true;

      if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
      }

      if (Array.isArray(a) !== Array.isArray(b)) return false;

      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this.deepEquals(a[i], b[i])) return false;
        }
        return true;
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!this.deepEquals(a[key], b[key])) return false;
      }

      return true;
    },

    /**
     * Deep clones Canonical IR data.
     */
    clone: function (val) {
      if (typeof globalThis.structuredClone === 'function') {
        try {
          return globalThis.structuredClone(val);
        } catch (_) {
          // Fallback to recursive clone
        }
      }
      return this._recursiveClone(val, new WeakMap());
    },

    _recursiveClone: function (val, visited) {
      if (this.isPrimitive(val)) return val;
      if (visited.has(val)) return visited.get(val);

      if (Array.isArray(val)) {
        const arr = [];
        visited.set(val, arr);
        for (let i = 0; i < val.length; i++) {
          arr.push(this._recursiveClone(val[i], visited));
        }
        return arr;
      }

      if (typeof val === 'object') {
        const obj = {};
        visited.set(val, obj);
        const keys = Object.keys(val);
        for (let i = 0; i < keys.length; i++) {
          obj[keys[i]] = this._recursiveClone(val[keys[i]], visited);
        }
        return obj;
      }

      return val;
    },

    /**
     * Computes structural metrics and statistics for an IR tree.
     */
    getStats: function (val) {
      let nodeCount = 0;
      let maxDepth = 0;
      let keyCount = 0;
      let arrayItemCount = 0;
      const types = { string: 0, number: 0, boolean: 0, null: 0, array: 0, object: 0 };

      function walk(node, depth) {
        nodeCount++;
        if (depth > maxDepth) maxDepth = depth;

        if (node === null) {
          types.null++;
        } else if (Array.isArray(node)) {
          types.array++;
          arrayItemCount += node.length;
          for (let i = 0; i < node.length; i++) {
            walk(node[i], depth + 1);
          }
        } else if (typeof node === 'object') {
          types.object++;
          const keys = Object.keys(node);
          keyCount += keys.length;
          for (let i = 0; i < keys.length; i++) {
            walk(node[keys[i]], depth + 1);
          }
        } else {
          const t = typeof node;
          if (types[t] !== undefined) types[t]++;
        }
      }

      walk(val, val !== undefined ? 1 : 0);

      let byteSize = 0;
      try {
        const json = JSON.stringify(val);
        if (typeof TextEncoder !== 'undefined') {
          byteSize = new TextEncoder().encode(json || '').length;
        } else if (typeof Buffer !== 'undefined') {
          byteSize = Buffer.byteLength(json || '', 'utf8');
        } else {
          byteSize = (json || '').length;
        }
      } catch (_) {
        byteSize = 0;
      }

      return {
        nodeCount: nodeCount,
        maxDepth: maxDepth,
        keyCount: keyCount,
        arrayItemCount: arrayItemCount,
        byteSize: byteSize,
        types: types
      };
    },

    /**
     * Safe depth-first traversal.
     * @param {any} ir
     * @param {Function} visitor - (value, path, parent, key) => boolean | void (return false to stop subtree)
     */
    traverse: function (ir, visitor) {
      function walk(current, path, parent, key) {
        const shouldContinue = visitor(current, path, parent, key);
        if (shouldContinue === false) return;

        if (Array.isArray(current)) {
          for (let i = 0; i < current.length; i++) {
            walk(current[i], path.concat(i), current, i);
          }
        } else if (current && typeof current === 'object') {
          const keys = Object.keys(current);
          for (let i = 0; i < keys.length; i++) {
            walk(current[keys[i]], path.concat(keys[i]), current, keys[i]);
          }
        }
      }
      walk(ir, [], null, null);
    },

    /**
     * Resolves value at array of path segments or JSON Pointer.
     */
    getAtPath: function (ir, path) {
      const segments = Array.isArray(path) ? path : this.parsePointer(path);
      let curr = ir;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (isUnsafeKey(seg)) return undefined;
        if (curr === null || typeof curr !== 'object' || !Object.prototype.hasOwnProperty.call(curr, seg)) return undefined;
        curr = curr[seg];
      }
      return curr;
    },

    /**
     * Sets value at array of path segments or JSON Pointer.
     */
    setAtPath: function (ir, path, value) {
      const segments = Array.isArray(path) ? path : this.parsePointer(path);
      if (segments.length === 0) return value;
      for (let s = 0; s < segments.length; s++) {
        if (isUnsafeKey(segments[s])) {
          return ir;
        }
      }
      let curr = ir;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (!Object.prototype.hasOwnProperty.call(curr, seg) || curr[seg] === null || typeof curr[seg] !== 'object') {
          curr[seg] = /^\d+$/.test(segments[i + 1]) ? [] : {};
        }
        curr = curr[seg];
      }
      curr[segments[segments.length - 1]] = value;
      return ir;
    },

    /**
     * Parses RFC 6901 JSON pointer into segment array.
     */
    parsePointer: function (pointer) {
      if (!pointer || pointer === '/') return [];
      if (pointer.charCodeAt(0) === 47 /* '/' */) pointer = pointer.slice(1);
      return pointer.split('/').map(function (seg) {
        return seg.replace(/~1/g, '/').replace(/~0/g, '~');
      });
    },

    /**
     * Formats path segment array into RFC 6901 JSON Pointer.
     */
    toPointer: function (segments) {
      if (!segments || segments.length === 0) return '';
      return '/' + segments.map(function (s) {
        return String(s).replace(/~/g, '~0').replace(/\//g, '~1');
      }).join('/');
    }
  };

  return IR;
});

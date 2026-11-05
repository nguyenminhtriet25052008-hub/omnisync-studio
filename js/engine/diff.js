/**
 * js/engine/diff.js - Structural Tree Diff & RFC 6902 JSON Patch Engine
 * OmniSync Studio - Browser & Node.js Isomorphic Module
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    const IR = require('./ir.js');
    const mod = factory(IR);
    module.exports = mod;
    module.exports.Diff = mod;
  } else {
    root.OmniSync = root.OmniSync || {};
    const IR = root.OmniSync.IR || root.IR;
    const mod = factory(IR);
    root.OmniSync.Diff = mod;
    root.Diff = mod;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (IR) {
  'use strict';

  function escapePointerSegment(str) {
    return String(str).replace(/~/g, '~0').replace(/\//g, '~1');
  }

  function isUnsafeKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  const Diff = {
    /**
     * Compares tree A and tree B, generating an RFC 6902 JSON Patch array
     * and categorized structural differences.
     * @param {any} a - Original IR tree
     * @param {any} b - Modified IR tree
     * @returns {object} { patches: Array, additions: Array, removals: Array, modifications: Array, summary: string }
     */
    compare: function (a, b) {
      const patches = [];
      const additions = [];
      const removals = [];
      const modifications = [];

      function diffRecursive(valA, valB, path) {
        if (Object.is(valA, valB)) return;

        // If either is primitive, or types differ, it's a replacement
        const isPrimA = IR.isPrimitive(valA);
        const isPrimB = IR.isPrimitive(valB);

        if (isPrimA || isPrimB || Array.isArray(valA) !== Array.isArray(valB)) {
          patches.push({ op: 'replace', path: path || '/', value: valB });
          modifications.push({ path: path || '/', oldValue: valA, newValue: valB });
          return;
        }

        // Both are Arrays
        if (Array.isArray(valA) && Array.isArray(valB)) {
          const minLen = Math.min(valA.length, valB.length);
          for (let i = 0; i < minLen; i++) {
            diffRecursive(valA[i], valB[i], `${path}/${i}`);
          }
          if (valB.length > valA.length) {
            for (let i = minLen; i < valB.length; i++) {
              const itemPath = `${path}/${i}`;
              patches.push({ op: 'add', path: itemPath, value: valB[i] });
              additions.push({ path: itemPath, value: valB[i] });
            }
          } else if (valA.length > valB.length) {
            // Removals in reverse order to maintain index integrity
            for (let i = valA.length - 1; i >= minLen; i--) {
              const itemPath = `${path}/${i}`;
              patches.push({ op: 'remove', path: itemPath });
              removals.push({ path: itemPath, oldValue: valA[i] });
            }
          }
          return;
        }

        // Both are Objects
        if (typeof valA === 'object' && typeof valB === 'object') {
          const keysA = Object.keys(valA);
          const keysB = Object.keys(valB);
          const setB = new Set(keysB);

          // Keys removed
          for (let i = 0; i < keysA.length; i++) {
            const k = keysA[i];
            if (isUnsafeKey(k)) continue;
            if (!setB.has(k)) {
              const keyPath = `${path}/${escapePointerSegment(k)}`;
              patches.push({ op: 'remove', path: keyPath });
              removals.push({ path: keyPath, oldValue: valA[k] });
            }
          }

          // Keys added or modified
          for (let i = 0; i < keysB.length; i++) {
            const k = keysB[i];
            if (isUnsafeKey(k)) continue;
            const keyPath = `${path}/${escapePointerSegment(k)}`;
            if (!Object.prototype.hasOwnProperty.call(valA, k)) {
              patches.push({ op: 'add', path: keyPath, value: valB[k] });
              additions.push({ path: keyPath, value: valB[k] });
            } else {
              diffRecursive(valA[k], valB[k], keyPath);
            }
          }
        }
      }

      diffRecursive(a, b, '');

      // Build summary string
      let summary = '';
      if (patches.length === 0) {
        summary = 'Identical (0 changes)';
      } else {
        const parts = [];
        if (additions.length > 0) parts.push(`+${additions.length} added`);
        if (removals.length > 0) parts.push(`-${removals.length} removed`);
        if (modifications.length > 0) parts.push(`~${modifications.length} modified`);
        summary = parts.join(', ');
      }

      return {
        patches: patches,
        additions: additions,
        removals: removals,
        modifications: modifications,
        summary: summary
      };
    },

    /**
     * Applies RFC 6902 JSON Patches to a target Canonical IR tree.
     * Returns a new cloned tree with patches applied.
     */
    applyPatch: function (target, patches) {
      if (!patches || patches.length === 0) return IR.clone(target);
      let root = IR.clone(target);

      for (let i = 0; i < patches.length; i++) {
        const patch = patches[i];
        if (!patch || typeof patch !== 'object') continue;

        const segments = IR.parsePointer(patch.path || '');

        if (segments.length === 0) {
          if (patch.op === 'replace' || patch.op === 'add') {
            root = patch.value;
            continue;
          }
          throw new Error(`Cannot perform ${patch.op} on root path`);
        }

        if (segments.some(isUnsafeKey)) {
          continue;
        }

        const lastKey = segments[segments.length - 1];
        if (isUnsafeKey(lastKey)) {
          continue;
        }

        const parentSegments = segments.slice(0, -1);
        const parent = IR.getAtPath(root, parentSegments);

        if (!parent || typeof parent !== 'object' || parent === Object.prototype || parent === Function.prototype || parent === Array.prototype) {
          throw new Error(`Invalid patch path parent: ${patch.path}`);
        }

        switch (patch.op) {
          case 'add':
            if (Array.isArray(parent)) {
              if (lastKey === '-') {
                parent.push(patch.value);
              } else {
                const idx = parseInt(lastKey, 10);
                parent.splice(idx, 0, patch.value);
              }
            } else {
              parent[lastKey] = patch.value;
            }
            break;

          case 'remove':
            if (Array.isArray(parent)) {
              const idx = parseInt(lastKey, 10);
              parent.splice(idx, 1);
            } else {
              delete parent[lastKey];
            }
            break;

          case 'replace':
            if (Array.isArray(parent)) {
              const idx = parseInt(lastKey, 10);
              parent[idx] = patch.value;
            } else {
              parent[lastKey] = patch.value;
            }
            break;

          default:
            throw new Error(`Unsupported patch operation: ${patch.op}`);
        }
      }

      return root;
    }
  };

  return Diff;
});

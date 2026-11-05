/**
 * tests/m2_challenger2.js - Milestone 2 Empirical Adversarial Stress Test Suite
 * OmniSync Data Studio - UI State Machine, Debounce & Cross-Format Stability
 *
 * Zero-dependency isomorphic test harness for Node.js and browser environments.
 * Challenges:
 * 1. Format swapping under active sync & debounced mid-conversion race conditions.
 * 2. RFC 6902 Diff Visualizer extreme edge cases (disjoint, permutations, depth > 10).
 * 3. Toast notification queue concurrency capping (max 3) & clean DOM teardown.
 * 4. Export MIME type validation, filename mapping, and Unicode Blob generation safety.
 */
'use strict';

(function (root) {
  const isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node;
  let assert;
  let path;
  let fs;

  if (isNode) {
    assert = require('assert');
    path = require('path');
    fs = require('fs');
  } else {
    assert = {
      strictEqual: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
      ok: (val, msg) => { if (!val) throw new Error(msg || 'Value is falsy'); },
      deepStrictEqual: (a, b, msg) => {
        if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || `Objects not deeply equal`);
      },
      match: (str, re, msg) => { if (!re.test(str)) throw new Error(msg || `${str} does not match ${re}`); }
    };
  }

  // ---------------------------------------------------------------------------
  // Comprehensive Isomorphic Mock DOM Implementation
  // ---------------------------------------------------------------------------
  class MockDOMNode {
    constructor(tagName, id = '', className = '') {
      this.tagName = tagName ? tagName.toUpperCase() : 'DIV';
      this.id = id;
      this._className = '';
      this.classList = new Set();
      this._bindClassList();
      this.className = className;

      this.attributes = new Map();
      this.listeners = new Map();
      this.children = [];
      this.parentNode = null;
      this.style = {};
      this.value = '';
      this._textContent = '';
      this._innerHTML = '';
      this.selectionStart = 0;
      this.selectionEnd = 0;
      this.scrollTop = 0;
      this.clientHeight = 400;
      this.scrollHeight = 1000;
      this.isFocused = false;
      this.disabled = false;
    }

    _bindClassList() {
      const origAdd = Set.prototype.add.bind(this.classList);
      const origDelete = Set.prototype.delete.bind(this.classList);
      const origHas = Set.prototype.has.bind(this.classList);
      this.classList.add = (c) => { origAdd(c); this._className = Array.from(this.classList).join(' '); };
      this.classList.remove = (c) => { origDelete(c); this._className = Array.from(this.classList).join(' '); };
      this.classList.contains = (c) => origHas(c);
      this.classList.toggle = (c) => {
        const has = origHas(c);
        if (has) origDelete(c); else origAdd(c);
        this._className = Array.from(this.classList).join(' ');
        return !has;
      };
    }

    get className() { return this._className; }
    set className(val) {
      this._className = val ? String(val).trim() : '';
      this.classList = new Set(this._className ? this._className.split(/\s+/).filter(Boolean) : []);
      this._bindClassList();
    }

    get firstChild() { return this.children[0] || null; }
    get lastChild() { return this.children[this.children.length - 1] || null; }
    get parentElement() { return this.parentNode; }

    get textContent() {
      if (this.children.length > 0) {
        return this.children.map(c => c.textContent).join('');
      }
      return this._textContent;
    }
    set textContent(val) {
      this._textContent = String(val);
      this.children = [];
      this._innerHTML = String(val).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    get innerHTML() { return this._innerHTML; }
    set innerHTML(val) {
      this._innerHTML = String(val);
      this._textContent = String(val).replace(/<[^>]*>?/gm, '');
      this.children = [];

      // Parse basic child elements for toast / badge testing
      const toastMsgMatch = val.match(/class=["']toast-message["']>([^<]*)</);
      if (toastMsgMatch) {
        const msgNode = new MockDOMNode('SPAN', '', 'toast-message');
        msgNode.textContent = toastMsgMatch[1];
        this.appendChild(msgNode);
      }
      if (val.includes('toast-dismiss')) {
        const btnNode = new MockDOMNode('BUTTON', '', 'toast-dismiss');
        this.appendChild(btnNode);
      }
    }

    setAttribute(key, val) { this.attributes.set(key, String(val)); }
    getAttribute(key) { return this.attributes.has(key) ? this.attributes.get(key) : null; }
    removeAttribute(key) { this.attributes.delete(key); }
    hasAttribute(key) { return this.attributes.has(key); }

    addEventListener(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    }
    removeEventListener(event, fn) {
      if (!this.listeners.has(event)) return;
      this.listeners.set(event, this.listeners.get(event).filter(f => f !== fn));
    }
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      const fns = this.listeners.get(event.type) || [];
      fns.forEach(fn => fn.call(this, event));
      return true;
    }

    appendChild(child) {
      if (!child) return null;
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }

    insertBefore(newChild, refChild) {
      if (!refChild) return this.appendChild(newChild);
      const idx = this.children.indexOf(refChild);
      if (idx === -1) return this.appendChild(newChild);
      if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
      newChild.parentNode = this;
      this.children.splice(idx, 0, newChild);
      return newChild;
    }

    focus() { this.isFocused = true; }
    blur() { this.isFocused = false; }
    click() { this.dispatchEvent({ type: 'click', target: this }); }

    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    }

    scrollTo(opts) {
      if (opts && typeof opts.top === 'number') this.scrollTop = opts.top;
    }

    closest(selector) {
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        let curr = this;
        while (curr) {
          if (curr.classList && curr.classList.contains(cls)) return curr;
          curr = curr.parentNode;
        }
      }
      return this;
    }

    querySelector(selector) {
      for (const child of this.children) {
        if (selector.startsWith('#') && child.id === selector.slice(1)) return child;
        if (selector.startsWith('.') && child.classList && child.classList.contains(selector.slice(1))) return child;
        if (child.tagName.toLowerCase() === selector.toLowerCase()) return child;
        const sub = child.querySelector(selector);
        if (sub) return sub;
      }
      return null;
    }

    querySelectorAll(selector) {
      const results = [];
      const traverse = (node) => {
        for (const child of node.children) {
          if (selector.startsWith('#') && child.id === selector.slice(1)) results.push(child);
          else if (selector.startsWith('.') && child.classList && child.classList.contains(selector.slice(1))) results.push(child);
          else if (child.tagName.toLowerCase() === selector.toLowerCase()) results.push(child);
          traverse(child);
        }
      };
      traverse(this);
      return results;
    }
  }

  class MockDOMDocument {
    constructor() {
      this.elementsById = new Map();
      this.documentElement = new MockDOMNode('HTML');
      this.body = new MockDOMNode('BODY');
      this.documentElement.appendChild(this.body);
    }

    createElement(tag) { return new MockDOMNode(tag); }
    createDocumentFragment() { return new MockDOMNode('FRAGMENT'); }

    registerElement(id, el) {
      this.elementsById.set(id, el);
    }

    getElementById(id) {
      return this.elementsById.get(id) || this.documentElement.querySelector('#' + id) || null;
    }

    querySelector(selector) {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (this.elementsById.has(id)) return this.elementsById.get(id);
      }
      return this.documentElement.querySelector(selector);
    }

    querySelectorAll(selector) {
      return this.documentElement.querySelectorAll(selector);
    }
  }

  // ---------------------------------------------------------------------------
  // Test Runner State
  // ---------------------------------------------------------------------------
  const testResults = [];
  let currentSuiteName = '';

  function suite(name) {
    currentSuiteName = name;
    if (isNode) console.log(`\n\x1b[1m▶ [Challenger Suite] ${name}\x1b[0m`);
  }

  function test(name, fn) {
    const fullTestName = `[${currentSuiteName}] ${name}`;
    try {
      fn();
      testResults.push({ name: fullTestName, pass: true });
      if (isNode) console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err) {
      testResults.push({ name: fullTestName, pass: false, error: err });
      if (isNode) {
        console.error(`  \x1b[31m✖\x1b[0m ${name}`);
        console.error(`    \x1b[33mFailure Reason:\x1b[0m ${err.message}`);
      }
    }
  }

  async function testAsync(name, fn) {
    const fullTestName = `[${currentSuiteName}] ${name}`;
    try {
      await fn();
      testResults.push({ name: fullTestName, pass: true });
      if (isNode) console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err) {
      testResults.push({ name: fullTestName, pass: false, error: err });
      if (isNode) {
        console.error(`  \x1b[31m✖\x1b[0m ${name}`);
        console.error(`    \x1b[33mFailure Reason:\x1b[0m ${err.message}`);
      }
    }
  }

  // Helper delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ---------------------------------------------------------------------------
  // Main Test Runner
  // ---------------------------------------------------------------------------
  async function runAllChallengerTests() {
    console.log('\n======================================================================');
    console.log('  OmniSync Studio — Milestone 2 Empirical Adversarial Stress Suite   ');
    console.log('======================================================================');
    console.log(`Environment: Node.js ${process.version} | Platform: ${process.platform}\n`);

    // 1. Resolve Modules
    const baseDir = path.resolve(__dirname, '..');
    const IR = require(path.join(baseDir, 'js', 'engine', 'ir.js'));
    const Diff = require(path.join(baseDir, 'js', 'engine', 'diff.js'));
    const Validator = require(path.join(baseDir, 'js', 'engine', 'validator.js'));
    const SyncEngine = require(path.join(baseDir, 'js', 'engine', 'sync.js'));
    const parsers = {
      json: require(path.join(baseDir, 'js', 'parsers', 'json.js')),
      yaml: require(path.join(baseDir, 'js', 'parsers', 'yaml.js')),
      csv: require(path.join(baseDir, 'js', 'parsers', 'csv.js')),
      xml: require(path.join(baseDir, 'js', 'parsers', 'xml.js')),
      toml: require(path.join(baseDir, 'js', 'parsers', 'toml.js'))
    };

    // 2. Setup Mock DOM Environment
    const doc = new MockDOMDocument();
    global.document = doc;
    global.window = {
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
      addEventListener: (evt, fn) => doc.documentElement.addEventListener(evt, fn),
      dispatchEvent: (evt) => doc.documentElement.dispatchEvent(evt),
      isSecureContext: true
    };

    // Register all required DOM Elements
    const domIds = [
      'presetSelect', 'swapBtn', 'themeToggle', 'shortcutsBtn',
      'leftFormat', 'rightFormat', 'leftStats', 'rightStats',
      'leftEditor', 'rightEditor', 'leftCopyBtn', 'rightCopyBtn',
      'leftClearBtn', 'rightClearBtn', 'leftDownloadBtn', 'rightDownloadBtn',
      'errorBanner', 'errorMessageText', 'errorCodeFrameSnippet',
      'errorJumpBtn', 'errorDismissBtn', 'errorCoordsText', 'errorPaneBadge',
      'statusBadge', 'statusText', 'statusBarMessage', 'latencyPill',
      'diffSummaryPill', 'diffSummaryText', 'diffModal', 'diffModalCloseBtn',
      'diffPatchCardList', 'diffRawJsonBlock', 'diffCountAll', 'diffCountAdd',
      'diffCountRemove', 'diffCountReplace', 'diffModalSummaryBadge',
      'toastContainer', 'undoSnackbar', 'undoProgressBar', 'undoSnackbarBtn'
    ];

    domIds.forEach(id => {
      const tag = id.includes('Editor') ? 'TEXTAREA' : (id.includes('Select') || id.includes('Format') ? 'SELECT' : 'DIV');
      const el = doc.createElement(tag);
      el.id = id;
      doc.registerElement(id, el);
      doc.body.appendChild(el);
    });

    // Load UI controller
    const UI = require(path.join(baseDir, 'js', 'ui.js'));

    // Expose modules to global for App module resolution
    global.OmniSync = { UI, SyncEngine, parsers, Diff, Validator, IR };
    global.UI = UI;
    global.SyncEngine = SyncEngine;

    // Load App controller (auto-bootstraps on document present)
    const App = require(path.join(baseDir, 'js', 'app.js'));
    global.App = App;
    global.OmniSync.App = App;

    // =========================================================================
    // SUITE 1: Format Swapping & Active Sync Debounce Immunity
    // =========================================================================
    suite('Format Swapping & Active Sync Debounce Immunity');

    test('1.1 Format Swap while syntax error is active on left pane preserves isolation', () => {
      // Setup initial state: Left has broken JSON, Right has valid YAML
      const leftEditor = doc.getElementById('leftEditor');
      const rightEditor = doc.getElementById('rightEditor');
      const leftFmt = doc.getElementById('leftFormat');
      const rightFmt = doc.getElementById('rightFormat');

      leftFmt.value = 'json';
      rightFmt.value = 'yaml';
      leftEditor.value = '{"unclosed": "broken",';
      rightEditor.value = 'status: operational\ncode: 200';

      // Initialize App and trigger swap
      App.initEngine();
      UI.showErrorBanner('left', { line: 1, column: 23, message: 'Unclosed string' });
      assert.ok(UI.getActiveError() !== null, 'Active error must be set');

      // Trigger swap
      App.swapDirection();

      // Verified: formats swapped
      assert.strictEqual(leftFmt.value, 'yaml', 'Left format should now be YAML');
      assert.strictEqual(rightFmt.value, 'json', 'Right format should now be JSON');

      // Verified: Left now contains the valid YAML, which triggers sync to Right
      assert.strictEqual(leftEditor.value, 'status: operational\ncode: 200');
      // Right editor receives the converted JSON from leftEditor
      const parsedRight = JSON.parse(rightEditor.value);
      assert.strictEqual(parsedRight.status, 'operational');
      assert.strictEqual(parsedRight.code, 200);

      // Verified: Error banner is cleared on successful sync
      const banner = doc.getElementById('errorBanner');
      assert.ok(banner.classList.contains('hidden'), 'Error banner must be hidden after valid swap sync');
    });

    test('1.2 Format Swap while syntax error is active on right pane preserves opposing pane', () => {
      const leftEditor = doc.getElementById('leftEditor');
      const rightEditor = doc.getElementById('rightEditor');
      const leftFmt = doc.getElementById('leftFormat');
      const rightFmt = doc.getElementById('rightFormat');

      leftFmt.value = 'json';
      rightFmt.value = 'yaml';
      leftEditor.value = '{\n  "healthy": true\n}';
      rightEditor.value = '\tinvalid_tab_indent: yaml';

      App.initEngine();

      // Swap
      App.swapDirection();

      // Left now has invalid YAML (tab indentation forbidden in YAML), Right now has valid JSON
      assert.strictEqual(leftFmt.value, 'yaml');
      assert.strictEqual(rightFmt.value, 'json');
      assert.strictEqual(leftEditor.value, '\tinvalid_tab_indent: yaml');

      // Direction sync ran from Left (invalid YAML with tab indentation). It fails.
      // Crucial assertion: Right editor (opposing pane) MUST NOT be wiped, corrupted, or replaced with empty/error text!
      assert.strictEqual(rightEditor.value, '{\n  "healthy": true\n}', 'Opposing pane must remain uncorrupted');
      assert.ok(UI.getActiveError() !== null, 'Error must be active for the invalid source pane');
      assert.strictEqual(UI.getActiveError().pane, 'left', 'Error must be anchored to left pane');
    });

    await testAsync('1.3 Adversarial Race: Swap during active mid-conversion debounce must cancel pending timer', async () => {
      const leftEditor = doc.getElementById('leftEditor');
      const rightEditor = doc.getElementById('rightEditor');
      const leftFmt = doc.getElementById('leftFormat');
      const rightFmt = doc.getElementById('rightFormat');

      leftFmt.value = 'json';
      rightFmt.value = 'yaml';
      leftEditor.value = '{"dataset": "initial"}';
      rightEditor.value = 'dataset: initial';

      App.initEngine();

      // User types into Left editor (triggers handleInput with 250ms debounce)
      leftEditor.value = '{"dataset": "new_typing_update"}';
      App.syncEngine.handleInput('left', leftEditor.value, 'json', 'yaml');

      // Verify that debounce timer is active
      assert.ok(App.syncEngine.debounceTimer !== null, 'Debounce timer must be pending');

      // Mid-flight swap at 40ms (well before 250ms debounce expires!)
      await delay(40);
      App.swapDirection();

      // Formats are now: Left = YAML, Right = JSON
      assert.strictEqual(leftFmt.value, 'yaml');
      assert.strictEqual(rightFmt.value, 'json');

      const expectedJsonInRight = rightEditor.value;

      // Wait 300ms so that the original 250ms debounce timer would have expired
      await delay(300);

      // EMPIRICAL CHALLENGE CHECK:
      // If the debounce timer was NOT cancelled by swapDirection(), it fired with stale
      // parameters ('json' -> 'yaml') and wrote YAML into rightEditor (which is JSON mode)!
      // Therefore, if rightEditor is YAML, or if App.syncEngine.debounceTimer was not cleared, this is a bug!
      let parsedAsJson = null;
      let parseErr = null;
      try {
        parsedAsJson = JSON.parse(rightEditor.value);
      } catch (e) {
        parseErr = e;
      }

      if (parseErr || rightEditor.value.includes('dataset: new_typing_update')) {
        throw new Error(
          `STALE DEBOUNCE BUG DETECTED: Swap during active typing did not cancel pending timer! ` +
          `Stale debounce fired after swap and corrupted rightEditor with YAML content instead of JSON. ` +
          `Value was: ${JSON.stringify(rightEditor.value)}`
        );
      }

      assert.ok(parsedAsJson !== null, 'Right editor content must remain valid JSON');
    });

    test('1.4 Rapid double-swap (Alt+S x2) returns exactly to original state', () => {
      const leftEditor = doc.getElementById('leftEditor');
      const rightEditor = doc.getElementById('rightEditor');
      const leftFmt = doc.getElementById('leftFormat');
      const rightFmt = doc.getElementById('rightFormat');

      leftFmt.value = 'csv';
      rightFmt.value = 'json';
      leftEditor.value = 'id,name\n1,Triet\n2,Minh';
      rightEditor.value = '[{"id":1,"name":"Triet"},{"id":2,"name":"Minh"}]';

      const origLeftFmt = leftFmt.value;
      const origRightFmt = rightFmt.value;
      const origLeftVal = leftEditor.value;
      const origRightVal = rightEditor.value;

      App.initEngine();

      // Swap 1
      App.swapDirection();
      assert.strictEqual(leftFmt.value, origRightFmt);
      assert.strictEqual(rightFmt.value, origLeftFmt);

      // Swap 2
      App.swapDirection();
      assert.strictEqual(leftFmt.value, origLeftFmt, 'Format must revert after double swap');
      assert.strictEqual(rightFmt.value, origRightFmt, 'Format must revert after double swap');
      assert.strictEqual(leftEditor.value.replace(/\r\n/g, '\n'), origLeftVal.replace(/\r\n/g, '\n'), 'Content must revert after double swap');
    });

    // =========================================================================
    // SUITE 2: RFC 6902 Diff Visualizer Edge Cases
    // =========================================================================
    suite('RFC 6902 Diff Visualizer Edge Cases');

    test('2.1 Diffing structurally identical documents produces zero patch operations', () => {
      const docA = {
        meta: { version: '2.0.0', author: 'Nguyen Minh Triet' },
        tags: ['studio', 'omnisync', 'reactive'],
        active: true,
        count: 42
      };
      const docB = JSON.parse(JSON.stringify(docA));

      const diff = Diff.compare(docA, docB);
      assert.strictEqual(diff.patches.length, 0, 'Patches count must be 0 for identical documents');
      assert.strictEqual(diff.additions.length, 0);
      assert.strictEqual(diff.removals.length, 0);
      assert.strictEqual(diff.modifications.length, 0);
      assert.strictEqual(diff.summary, 'Identical (0 changes)');

      // Verify UI Diff Renderer renders empty state cleanly
      UI.renderDiffCards(diff, 'all');
      const container = doc.getElementById('diffPatchCardList');
      assert.ok(container.innerHTML.includes('diff-empty-state'), 'Must display empty state');
      assert.ok(container.innerHTML.includes('Datasets are Structurally Identical'));
    });

    test('2.2 Diffing completely disjoint documents generates accurate removals and additions', () => {
      const docA = { a: 10, b: 'old_text', c: [1, 2] };
      const docB = { x: 99, y: 'new_text', z: { sub: true } };

      const diff = Diff.compare(docA, docB);
      assert.strictEqual(diff.removals.length, 3, 'Must remove keys a, b, c');
      assert.strictEqual(diff.additions.length, 3, 'Must add keys x, y, z');
      assert.strictEqual(diff.patches.length, 6, 'Total 6 operations');

      // Verify RFC 6902 applyPatch invariant: applyPatch(docA, diff.patches) == docB
      const reconstructed = Diff.applyPatch(docA, diff.patches);
      assert.ok(IR.deepEquals(reconstructed, docB), 'applyPatch must reconstruct docB exactly');
    });

    test('2.3 Diffing array permutations and reversals preserves structural integrity', () => {
      // Inverted array
      const arrA = [1, 2, 3, 4, 5];
      const arrB = [5, 4, 3, 2, 1];
      const diff1 = Diff.compare(arrA, arrB);
      const patched1 = Diff.applyPatch(arrA, diff1.patches);
      assert.deepStrictEqual(patched1, arrB, 'applyPatch must reconstruct inverted array');

      // Complex permutation with length expansion
      const arrC = ['alpha', 'bravo', 'charlie'];
      const arrD = ['charlie', 'alpha', 'bravo', 'delta', 'echo'];
      const diff2 = Diff.compare(arrC, arrD);
      const patched2 = Diff.applyPatch(arrC, diff2.patches);
      assert.deepStrictEqual(patched2, arrD, 'applyPatch must reconstruct expanded permuted array');

      // Array permutation with length shrinkage
      const arrE = [10, 20, 30, 40, 50, 60];
      const arrF = [60, 20];
      const diff3 = Diff.compare(arrE, arrF);
      const patched3 = Diff.applyPatch(arrE, diff3.patches);
      assert.deepStrictEqual(patched3, arrF, 'applyPatch must reconstruct shrunk permuted array');
    });

    test('2.4 Diffing deep nested objects (depth > 10, depth = 15) handles recursion safely', () => {
      function buildDeepObject(depth, leafKey, leafVal) {
        let rootObj = {};
        let curr = rootObj;
        for (let i = 1; i < depth; i++) {
          curr['level_' + i] = {};
          curr = curr['level_' + i];
        }
        curr[leafKey] = leafVal;
        return rootObj;
      }

      const deepA = buildDeepObject(15, 'leaf', 'ORIGINAL_VALUE');
      const deepB = buildDeepObject(15, 'leaf', 'MODIFIED_VALUE');

      const diff = Diff.compare(deepA, deepB);
      assert.strictEqual(diff.patches.length, 1, 'Should have exactly 1 replace patch');
      assert.strictEqual(diff.patches[0].op, 'replace');

      const expectedPath = '/level_1/level_2/level_3/level_4/level_5/level_6/level_7/level_8/level_9/level_10/level_11/level_12/level_13/level_14/leaf';
      assert.strictEqual(diff.patches[0].path, expectedPath);

      // Verify RFC 6902 applyPatch on depth 15
      const reconstructed = Diff.applyPatch(deepA, diff.patches);
      assert.ok(IR.deepEquals(reconstructed, deepB), 'applyPatch must reconstruct deep hierarchy');
    });

    test('2.5 Diff visualizer card filtering partitions patches correctly', () => {
      const mockDiff = {
        summary: '+1 added, -1 removed, ~1 modified',
        patches: [
          { op: 'add', path: '/newKey', value: 123 },
          { op: 'remove', path: '/oldKey', oldValue: 'test' },
          { op: 'replace', path: '/modKey', oldValue: 1, value: 2 }
        ]
      };

      // Filter: all
      UI.renderDiffCards(mockDiff, 'all');
      let cardList = doc.getElementById('diffPatchCardList');
      assert.strictEqual(cardList.children.length, 3, 'Should render 3 cards for "all"');

      // Filter: add
      UI.renderDiffCards(mockDiff, 'add');
      assert.strictEqual(cardList.children.length, 1);
      assert.ok(cardList.children[0].classList.contains('op-add'));

      // Filter: remove
      UI.renderDiffCards(mockDiff, 'remove');
      assert.strictEqual(cardList.children.length, 1);
      assert.ok(cardList.children[0].classList.contains('op-remove'));

      // Filter: replace
      UI.renderDiffCards(mockDiff, 'replace');
      assert.strictEqual(cardList.children.length, 1);
      assert.ok(cardList.children[0].classList.contains('op-replace'));
    });

    // =========================================================================
    // SUITE 3: Toast Notification Queue & Lifecycle
    // =========================================================================
    suite('Toast Notification Queue & Lifecycle');

    test('3.1 Burst spam of 50 rapid toasts strictly caps concurrent DOM nodes to 3', () => {
      let maxObservedDuringSpam = 0;
      const container = doc.getElementById('toastContainer');
      container.children = [];

      for (let i = 1; i <= 50; i++) {
        UI.showToast(`Notification #${i}`, 'info', 50);
        if (container.children.length > maxObservedDuringSpam) {
          maxObservedDuringSpam = container.children.length;
        }
      }

      assert.ok(maxObservedDuringSpam <= 3, `Concurrent toasts must never exceed 3 (saw: ${maxObservedDuringSpam})`);
      assert.strictEqual(container.children.length, 3, 'Final toast count after spam must be exactly 3');
    });

    test('3.2 FIFO eviction preserves only the latest 3 toasts', () => {
      const container = doc.getElementById('toastContainer');
      const messages = container.children.map(c => {
        const span = c.querySelector('.toast-message');
        return span ? span.textContent : '';
      });

      assert.strictEqual(messages[0], 'Notification #48', 'First remaining toast must be #48');
      assert.strictEqual(messages[1], 'Notification #49', 'Second remaining toast must be #49');
      assert.strictEqual(messages[2], 'Notification #50', 'Third remaining toast must be #50');
    });

    await testAsync('3.3 Clean DOM teardown without orphaned elements or memory leaks', async () => {
      const container = doc.getElementById('toastContainer');
      // Wait for the 50ms duration + 180ms fade animation
      await delay(300);

      assert.strictEqual(container.children.length, 0, 'All toasts must be cleanly removed from DOM');
    });

    await testAsync('3.4 Manual dismiss button click immediately removes individual toast', async () => {
      const container = doc.getElementById('toastContainer');
      container.children = [];

      UI.showToast('Toast A', 'success', 5000);
      UI.showToast('Toast B', 'warning', 5000);
      assert.strictEqual(container.children.length, 2);

      // Find dismiss button of Toast A
      const toastA = container.children[0];
      const dismissBtn = toastA.querySelector('.toast-dismiss');
      assert.ok(dismissBtn !== null, 'Dismiss button must exist');

      dismissBtn.click();
      await delay(220); // wait 180ms fade animation

      assert.strictEqual(container.children.length, 1, 'Toast A must be dismissed immediately');
      const remainingSpan = container.children[0].querySelector('.toast-message');
      assert.strictEqual(remainingSpan.textContent, 'Toast B');

      // Cleanup
      container.children = [];
    });

    // =========================================================================
    // SUITE 4: Export MIME Type & File Generation Validation
    // =========================================================================
    suite('Export MIME Type & File Generation Validation');

    test('4.1 MIME type and extension mapping across all 5 formats', () => {
      const expectedConfigs = {
        json: { ext: 'json', mime: 'application/json;charset=utf-8' },
        yaml: { ext: 'yaml', mime: 'application/x-yaml;charset=utf-8' },
        csv:  { ext: 'csv',  mime: 'text/csv;charset=utf-8' },
        xml:  { ext: 'xml',  mime: 'application/xml;charset=utf-8' },
        toml: { ext: 'toml', mime: 'application/toml;charset=utf-8' }
      };

      for (const [fmt, expected] of Object.entries(expectedConfigs)) {
        const cfg = UI.FORMAT_CONFIG[fmt];
        assert.ok(cfg !== undefined, `FORMAT_CONFIG must define ${fmt}`);
        assert.strictEqual(cfg.extension, expected.ext, `${fmt} extension mismatch`);
        assert.strictEqual(cfg.mime, expected.mime, `${fmt} MIME type mismatch`);
      }
    });

    test('4.2 Timestamped filename format adheres to strict schema', () => {
      const filenameRegex = /^omnisync_(json|yaml|csv|xml|toml)_\d{8}_\d{6}\.(json|yaml|csv|xml|toml)$/;
      const formats = ['json', 'yaml', 'csv', 'xml', 'toml', 'JSON', 'YAML'];

      formats.forEach(fmt => {
        const filename = UI.getTimestampedFilename(fmt);
        assert.match(filename, filenameRegex, `Filename "${filename}" must match timestamp regex`);
      });
    });

    test('4.3 Blob generation safety with UTF-8 Unicode payloads', () => {
      const vietnamesePayload = 'Trường Đại học Bách Khoa TP.HCM - Nguyễn Minh Triết - Khoa Điện - Điện tử (2026)';
      const mime = 'application/json;charset=utf-8';

      // Test native Blob constructor
      const blob = new Blob([vietnamesePayload], { type: mime });
      assert.strictEqual(blob.type, mime, 'Blob MIME type must match');
      assert.strictEqual(blob.size, Buffer.byteLength(vietnamesePayload, 'utf-8'), 'Blob byte size must match UTF-8 length');
      assert.ok(blob.size > vietnamesePayload.length, 'UTF-8 multibyte size must exceed character count');
    });

    test('4.4 Empty or whitespace editor export is safely guarded', () => {
      let downloadInitiated = false;
      const originalCreateElement = doc.createElement.bind(doc);
      doc.createElement = function (tag) {
        const el = originalCreateElement(tag);
        if (tag.toLowerCase() === 'a') {
          el.click = () => { downloadInitiated = true; };
        }
        return el;
      };

      try {
        UI.downloadFile('empty.json', '', 'application/json;charset=utf-8');
        assert.strictEqual(downloadInitiated, false, 'Empty content must not trigger download');

        UI.downloadFile('whitespace.json', '   \n  \t  ', 'application/json;charset=utf-8');
        assert.strictEqual(downloadInitiated, false, 'Whitespace content must not trigger download');
      } finally {
        doc.createElement = originalCreateElement;
      }
    });

    await testAsync('4.5 ObjectURL revocation after download prevents memory leaks', async () => {
      let revokedUrl = null;
      const originalRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = function (url) {
        revokedUrl = url;
      };

      try {
        UI.downloadFile('test.json', '{"test": 1}', 'application/json;charset=utf-8');
        await delay(1100); // UI.downloadFile revokes after 1000ms
        assert.ok(revokedUrl !== null, 'URL.revokeObjectURL must be invoked after download');
        assert.ok(revokedUrl.startsWith('blob:'), 'Revoked URL must be a blob URL');
      } finally {
        URL.revokeObjectURL = originalRevoke;
      }
    });

    // -------------------------------------------------------------------------
    // Summary & Results
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------------');
    console.log('  Milestone 2 Challenger Summary                                      ');
    console.log('----------------------------------------------------------------------');
    const passed = testResults.filter(t => t.pass).length;
    const failed = testResults.filter(t => !t.pass).length;
    console.log(`  Total Tests  : ${testResults.length}`);
    console.log(`  Passed       : \x1b[32m${passed}\x1b[0m`);
    console.log(`  Failed       : \x1b[${failed > 0 ? '31' : '32'}m${failed}\x1b[0m`);
    console.log('----------------------------------------------------------------------\n');

    if (failed > 0) {
      console.log('\x1b[31mAdversarial Challenges Revealed Failure Modes:\x1b[0m');
      testResults.filter(t => !t.pass).forEach(t => {
        console.log(`- ${t.name}`);
        console.log(`  Error: ${t.error.message}`);
      });
      process.exitCode = 1;
    } else {
      console.log('\x1b[32mALL ADVERSARIAL CHALLENGES PASSED!\x1b[0m\n');
    }
  }

  if (isNode) {
    runAllChallengerTests().catch(err => {
      console.error('Fatal Test Runner Exception:', err);
      process.exit(1);
    });
  } else {
    root.runM2Challenger2 = runAllChallengerTests;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);

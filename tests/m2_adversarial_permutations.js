/**
 * tests/m2_adversarial_permutations.js - Milestone 2 Empirical Adversarial Stress Suite
 * OmniSync Data Studio - Rapid Action Permutations & Debounce Cancellation Verification
 *
 * Zero-dependency isomorphic test harness targeting:
 * 1. Rapid Swap Action Permutations under active mid-flight debounce
 * 2. Rapid Clear & Undo Permutations under active mid-flight debounce
 * 3. Rapid Sample Loading Permutations under active mid-flight debounce
 * 4. Interleaved Chaotic Rapid Permutations (Monkey Testing / Action Interleaving)
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Mock DOM Implementation
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
// Test Runner Harness
// ---------------------------------------------------------------------------
const testResults = [];
let currentSuiteName = '';

function suite(name) {
  currentSuiteName = name;
  console.log(`\n\x1b[1m▶ [Permutation Suite] ${name}\x1b[0m`);
}

async function testAsync(name, fn) {
  const fullTestName = `[${currentSuiteName}] ${name}`;
  try {
    await fn();
    testResults.push({ name: fullTestName, pass: true });
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    testResults.push({ name: fullTestName, pass: false, error: err });
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[33mFailure Reason:\x1b[0m ${err.message}`);
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
async function runAllPermutationTests() {
  console.log('======================================================================');
  console.log('  OmniSync Studio — Milestone 2 Rapid Action Permutations Stress Suite');
  console.log('======================================================================');
  console.log(`Environment: Node.js ${process.version} | Platform: ${process.platform}\n`);

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

  const doc = new MockDOMDocument();
  global.document = doc;
  global.window = {
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    addEventListener: (evt, fn) => doc.documentElement.addEventListener(evt, fn),
    dispatchEvent: (evt) => doc.documentElement.dispatchEvent(evt),
    isSecureContext: true
  };

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
    'toastContainer', 'undoSnackbar', 'undoProgressBar', 'undoSnackbarBtn',
    'btnCenterSync', 'btnDismissUndo', 'mobileLeftFormatLabel', 'mobileRightFormatLabel'
  ];

  domIds.forEach(id => {
    const tag = id.includes('Editor') ? 'TEXTAREA' : (id.includes('Select') || id.includes('Format') ? 'SELECT' : 'DIV');
    const el = doc.createElement(tag);
    el.id = id;
    doc.registerElement(id, el);
    doc.body.appendChild(el);
  });

  const UI = require(path.join(baseDir, 'js', 'ui.js'));
  global.OmniSync = { UI, SyncEngine, parsers, Diff, Validator, IR };
  global.UI = UI;
  global.SyncEngine = SyncEngine;

  const App = require(path.join(baseDir, 'js', 'app.js'));
  global.App = App;
  global.OmniSync.App = App;

  // Cache element references
  const leftEditor = doc.getElementById('leftEditor');
  const rightEditor = doc.getElementById('rightEditor');
  const leftFmt = doc.getElementById('leftFormat');
  const rightFmt = doc.getElementById('rightFormat');
  const swapBtn = doc.getElementById('swapBtn');
  const leftClearBtn = doc.getElementById('leftClearBtn');
  const rightClearBtn = doc.getElementById('rightClearBtn');
  const presetSelect = doc.getElementById('presetSelect');
  const undoBtn = doc.getElementById('undoSnackbarBtn');
  const centerSyncBtn = doc.getElementById('btnCenterSync');

  // Helper reset function between tests
  function resetStudio(leftFormatVal = 'json', rightFormatVal = 'yaml') {
    App.syncEngine.cancelPending();
    UI.clearUndoSnackbar();
    UI.clearErrorBanner('left');
    UI.clearErrorBanner('right');

    leftFmt.value = leftFormatVal;
    rightFmt.value = rightFormatVal;
    leftEditor.value = '';
    rightEditor.value = '';
    App.lastActivePane = 'left';
    App.autoSync = true;
  }

  // =========================================================================
  // SUITE 1: Rapid Swap Permutations & Direction Inversion Under Active Debounce
  // =========================================================================
  suite('Rapid Swap Permutations & Debounce Race Immunity');

  await testAsync('1.1 Left typing with pending debounce followed by rapid Swap (via DOM click) cancels stale conversion', async () => {
    resetStudio('json', 'yaml');
    leftEditor.value = '{"origin": "pre_swap_left"}';
    rightEditor.value = 'origin: pre_swap_right';

    // User types in left editor (triggers 250ms debounce)
    leftEditor.value = '{"origin": "typing_in_progress"}';
    leftEditor.dispatchEvent({ type: 'input' });

    assert.ok(App.syncEngine.debounceTimer !== null, 'Debounce timer should be running');

    // Click swap at 40ms
    await delay(40);
    swapBtn.click();

    // After swap: Left = YAML, Right = JSON
    assert.strictEqual(leftFmt.value, 'yaml');
    assert.strictEqual(rightFmt.value, 'json');
    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Swap button click must cancel debounce timer');

    // Wait 300ms for original debounce window to elapse
    await delay(300);

    // Verify rightEditor contains valid JSON and did NOT get corrupted with stale YAML
    assert.doesNotThrow(() => JSON.parse(rightEditor.value), 'Right editor must contain valid JSON');
    assert.strictEqual(JSON.parse(rightEditor.value).origin, 'pre_swap_right');
    assert.ok(!rightEditor.value.includes('typing_in_progress'), 'Stale typing debounce must NOT overwrite right editor');
  });

  await testAsync('1.2 Right typing with pending debounce followed by rapid Swap cancels stale conversion', async () => {
    resetStudio('yaml', 'json');
    leftEditor.value = 'server: upstream\nport: 8080';
    rightEditor.value = '{"server": "upstream", "port": 8080}';

    // Type in Right editor (from JSON -> YAML direction)
    rightEditor.value = '{"server": "modified_in_right", "port": 9000}';
    rightEditor.dispatchEvent({ type: 'input' });

    assert.ok(App.syncEngine.debounceTimer !== null, 'Right editor debounce timer must be pending');

    // Click swap at 35ms
    await delay(35);
    swapBtn.click();

    // After swap: Left was YAML, Right was JSON -> Left is now JSON, Right is now YAML
    assert.strictEqual(leftFmt.value, 'json');
    assert.strictEqual(rightFmt.value, 'yaml');
    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Debounce must be cancelled on swap');

    await delay(300);

    // Left editor should have the modified data as valid JSON
    assert.doesNotThrow(() => JSON.parse(leftEditor.value), 'Left editor must be valid JSON');
    assert.strictEqual(JSON.parse(leftEditor.value).port, 9000);
    // Right editor should have converted YAML
    assert.ok(rightEditor.value.includes('port: 9000'), 'Right editor must contain converted YAML');
  });

  await testAsync('1.3 Rapid Odd Swap Burst (Alt+S x 3 within 20ms) maintains accurate inversion & zero ghost timer', async () => {
    resetStudio('json', 'csv');
    leftEditor.value = '[{"user": "alice", "active": true}]';
    rightEditor.value = 'user,active\nalice,true';

    // User types
    leftEditor.value = '[{"user": "bob", "active": false}]';
    leftEditor.dispatchEvent({ type: 'input' });

    // Burst swap 3 times rapidly
    await delay(20);
    swapBtn.click(); // 1st swap -> Left: csv, Right: json
    swapBtn.click(); // 2nd swap -> Left: json, Right: csv
    swapBtn.click(); // 3rd swap -> Left: csv, Right: json

    assert.strictEqual(leftFmt.value, 'csv', 'Triple swap must invert format');
    assert.strictEqual(rightFmt.value, 'json', 'Triple swap must invert format');
    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Final state must have no pending timers');

    await delay(300);

    // Target editor (right) should have JSON
    assert.doesNotThrow(() => JSON.parse(rightEditor.value), 'Right editor must be valid JSON');
  });

  await testAsync('1.4 Rapid Even Swap Burst (Alt+S x 4 within 20ms) returns format parity and cancels debounce', async () => {
    resetStudio('toml', 'xml');
    leftEditor.value = 'title = "Permutation Test"\nversion = 2';
    App.syncEngine.executeSync('left', leftEditor.value, 'toml', 'xml');

    // Type input to trigger debounce
    leftEditor.value = 'title = "Permutation Test"\nversion = 3';
    leftEditor.dispatchEvent({ type: 'input' });

    assert.ok(App.syncEngine.debounceTimer !== null);

    // Rapidly swap 4 times
    await delay(15);
    swapBtn.click();
    swapBtn.click();
    swapBtn.click();
    swapBtn.click();

    // Format parity preserved
    assert.strictEqual(leftFmt.value, 'toml', 'Quad swap must return format to TOML');
    assert.strictEqual(rightFmt.value, 'xml', 'Quad swap must return format to XML');
    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Debounce must be cancelled on swaps');

    await delay(300);

    // Right editor should contain valid XML
    assert.strictEqual(App.syncEngine.debounceTimer, null);
    assert.ok(rightEditor.value.includes('<title>'), 'Right editor must be valid XML');
  });

  // =========================================================================
  // SUITE 2: Rapid Clear & Undo Permutations Under Active Debounce
  // =========================================================================
  suite('Rapid Clear & Undo Permutations & Debounce Cancellation');

  await testAsync('2.1 Typing in Left pane followed by rapid Clear (at 40ms) prevents ghost sync from repopulating', async () => {
    resetStudio('json', 'yaml');
    leftEditor.value = '{"sensitive_token": "secret123"}';
    leftEditor.dispatchEvent({ type: 'input' });

    assert.ok(App.syncEngine.debounceTimer !== null, 'Debounce should be active');

    // User clicks Clear at 40ms
    await delay(40);
    leftClearBtn.click();

    // Verify editors are immediately cleared
    assert.strictEqual(leftEditor.value, '', 'Left editor must be cleared');
    assert.strictEqual(rightEditor.value, '', 'Right editor must be cleared');
    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Debounce timer MUST be cancelled by Clear');

    // Wait 300ms (beyond the original 250ms debounce window)
    await delay(300);

    // CRUCIAL INVARIANT: Editors must STILL be empty! No stale conversion should have fired!
    assert.strictEqual(leftEditor.value, '', 'Left editor must remain empty after debounce period');
    assert.strictEqual(rightEditor.value, '', 'Right editor must NOT be ghost-populated by cancelled debounce');
  });

  await testAsync('2.2 Typing in Left pane -> Clear -> Immediate Undo restores content and syncs cleanly', async () => {
    resetStudio('json', 'yaml');
    leftEditor.value = '{"id": 101, "name": "Nguyen Minh Triet"}';
    leftEditor.dispatchEvent({ type: 'input' });

    // Clear at 30ms
    await delay(30);
    leftClearBtn.click();
    assert.strictEqual(leftEditor.value, '');
    assert.strictEqual(rightEditor.value, '');

    // Undo at 60ms
    await delay(30);
    undoBtn.click();

    // Content restored
    assert.strictEqual(leftEditor.value, '{"id": 101, "name": "Nguyen Minh Triet"}');
    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Undo execution should cancel debounce and sync immediately');

    await delay(300);

    // Right editor should have YAML conversion
    assert.ok(rightEditor.value.includes('name: Nguyen Minh Triet'), 'Right editor must have converted YAML after undo');
  });

  await testAsync('2.3 Rapid Consecutive Clears (double-click Clear) does not throw error and cancels cleanly', async () => {
    resetStudio('yaml', 'json');
    leftEditor.value = 'module: power_grid\nvoltage: 220';
    App.syncEngine.executeSync('left', leftEditor.value, 'yaml', 'json');

    // Type new line
    leftEditor.value = 'module: power_grid\nvoltage: 240';
    leftEditor.dispatchEvent({ type: 'input' });

    // Double-click clear within 10ms
    leftClearBtn.click();
    await delay(10);
    leftClearBtn.click();

    assert.strictEqual(leftEditor.value, '');
    assert.strictEqual(rightEditor.value, '');
    assert.strictEqual(App.syncEngine.debounceTimer, null);

    await delay(300);
    assert.strictEqual(leftEditor.value, '');
    assert.strictEqual(rightEditor.value, '');
  });

  await testAsync('2.4 Right pane Clear cancels pending debounce triggered from Right editor input', async () => {
    resetStudio('json', 'yaml');
    leftEditor.value = '{"system": "ready"}';
    rightEditor.value = 'system: ready';

    // Type into Right editor
    rightEditor.value = 'system: updated_in_right';
    rightEditor.dispatchEvent({ type: 'input' });

    assert.ok(App.syncEngine.debounceTimer !== null);

    // Clear from Right pane
    await delay(40);
    rightClearBtn.click();

    assert.strictEqual(leftEditor.value, '');
    assert.strictEqual(rightEditor.value, '');
    assert.strictEqual(App.syncEngine.debounceTimer, null);

    await delay(300);
    assert.strictEqual(leftEditor.value, '', 'Left editor remains empty');
    assert.strictEqual(rightEditor.value, '', 'Right editor remains empty');
  });

  // =========================================================================
  // SUITE 3: Rapid Sample Loading Permutations Under Active Debounce
  // =========================================================================
  suite('Rapid Sample Loading Permutations & Debounce Cancellation');

  await testAsync('3.1 Custom typing in Left pane followed by rapid Sample Load (at 40ms) prevents typing overwrite', async () => {
    resetStudio('json', 'yaml');
    // User starts typing custom ad-hoc JSON
    leftEditor.value = '{"custom_adhoc_payload": 99999}';
    leftEditor.dispatchEvent({ type: 'input' });

    assert.ok(App.syncEngine.debounceTimer !== null);

    // User chooses sample preset before debounce fires
    await delay(40);
    presetSelect.value = 'users_table';
    presetSelect.dispatchEvent({ type: 'change' });

    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Sample load must cancel pending debounce');

    // Left editor now has the users_table sample data (CSV format)
    assert.ok(leftEditor.value.includes('Nguyen Minh Triet') || leftEditor.value.includes('salary'), 'Left editor should have users_table data');

    // Wait 300ms to verify custom_adhoc_payload does NOT resurface
    await delay(300);

    assert.ok(!leftEditor.value.includes('custom_adhoc_payload'), 'Custom ad-hoc payload must NOT overwrite sample in left');
    assert.ok(!rightEditor.value.includes('99999'), 'Custom ad-hoc payload must NOT overwrite sample in right');
    assert.strictEqual(App.syncEngine.debounceTimer, null);
  });

  await testAsync('3.2 Burst Sample Loading (rapidly switching 4 presets in 40ms) settles cleanly on the final sample', async () => {
    resetStudio('json', 'yaml');

    const presets = ['sensor_metrics', 'users_table', 'cloud_config', 'university_catalog'];

    for (const p of presets) {
      presetSelect.value = p;
      presetSelect.dispatchEvent({ type: 'change' });
      await delay(10);
    }

    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Debounce timer should be null after last load');

    // The active preset is university_catalog (XML -> JSON)
    assert.ok(leftEditor.value.includes('university') && leftEditor.value.includes('HCMUT'), 'Must have university_catalog data');

    await delay(300);

    // Verify rightEditor contains converted university_catalog data without conflict
    assert.ok(rightEditor.value.length > 0, 'Right editor must contain converted data');
    assert.strictEqual(App.syncEngine.debounceTimer, null);
  });

  // =========================================================================
  // SUITE 4: Interleaved Chaotic Permutations (Action Fuzzing / Stress Test)
  // =========================================================================
  suite('Interleaved Chaotic Rapid Action Permutations');

  await testAsync('4.1 Interleaved: Typing -> Swap (30ms) -> Clear (60ms) -> Wait 300ms leaves zero ghost data', async () => {
    resetStudio('json', 'yaml');

    leftEditor.value = '{"session": "transient"}';
    leftEditor.dispatchEvent({ type: 'input' });

    await delay(30);
    swapBtn.click();

    await delay(30);
    leftClearBtn.click();

    assert.strictEqual(leftEditor.value, '');
    assert.strictEqual(rightEditor.value, '');
    assert.strictEqual(App.syncEngine.debounceTimer, null);

    await delay(300);

    assert.strictEqual(leftEditor.value, '');
    assert.strictEqual(rightEditor.value, '');
  });

  await testAsync('4.2 Interleaved: Typing -> Clear (30ms) -> Undo (60ms) -> Swap (90ms) -> Wait 300ms', async () => {
    resetStudio('json', 'yaml');

    leftEditor.value = '{"device": "oscilloscope", "model": "DS1054Z"}';
    leftEditor.dispatchEvent({ type: 'input' });

    await delay(30);
    leftClearBtn.click();

    await delay(30);
    undoBtn.click();

    await delay(30);
    swapBtn.click();

    await delay(300);

    // Left should now have YAML, Right should have JSON
    assert.strictEqual(leftFmt.value, 'yaml');
    assert.strictEqual(rightFmt.value, 'json');
    assert.doesNotThrow(() => JSON.parse(rightEditor.value), 'Right editor must contain valid JSON');
    assert.strictEqual(JSON.parse(rightEditor.value).model, 'DS1054Z');
  });

  await testAsync('4.3 Target Format Change during active debounce cancels stale conversion & converts immediately', async () => {
    resetStudio('json', 'yaml');
    leftEditor.value = '{"component": "microcontroller", "pin_count": 32}';
    leftEditor.dispatchEvent({ type: 'input' });

    assert.ok(App.syncEngine.debounceTimer !== null);

    // Change target format to TOML at 40ms
    await delay(40);
    rightFmt.value = 'toml';
    rightFmt.dispatchEvent({ type: 'change' });

    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Format change must cancel pending debounce');

    // Right editor should immediately be TOML
    assert.ok(rightEditor.value.includes('pin_count = 32'), 'Right editor must immediately format to TOML');

    // Wait 300ms to ensure stale YAML conversion never fires
    await delay(300);

    assert.strictEqual(rightFmt.value, 'toml');
    assert.ok(rightEditor.value.includes('pin_count = 32'), 'Right editor must remain TOML');
    assert.ok(!rightEditor.value.includes('pin_count: 32'), 'Right editor must NOT contain YAML syntax');
  });

  await testAsync('4.4 Spamming Manual Sync button (10 rapid clicks) while debounce active cleanly synchronizes', async () => {
    resetStudio('json', 'yaml');
    leftEditor.value = '{"rapid_sync": true, "timestamp": 12345678}';
    leftEditor.dispatchEvent({ type: 'input' });

    // Click manual sync 10 times rapidly
    for (let i = 0; i < 10; i++) {
      centerSyncBtn.click();
      await delay(5);
    }

    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Debounce must be cancelled by manual sync');
    assert.ok(rightEditor.value.includes('rapid_sync: true'), 'Right editor must be synced');

    await delay(300);
    assert.strictEqual(App.syncEngine.debounceTimer, null);
    assert.ok(rightEditor.value.includes('rapid_sync: true'));
  });

  await testAsync('4.5 30-Cycle Chaotic Random Action Fuzzer preserves state machine integrity & zero unhandled exceptions', async () => {
    resetStudio('json', 'yaml');

    const sampleKeys = ['sensor_metrics', 'users_table', 'cloud_config', 'university_catalog'];

    let actionCount = 0;

    for (let i = 0; i < 30; i++) {
      const action = Math.floor(Math.random() * 6);
      actionCount++;

      switch (action) {
        case 0: // Typing in left
          leftEditor.value = JSON.stringify({ cycle: i, val: Math.random() });
          leftEditor.dispatchEvent({ type: 'input' });
          break;
        case 1: // Swap
          swapBtn.click();
          break;
        case 2: // Clear left
          leftClearBtn.click();
          break;
        case 3: // Undo
          undoBtn.click();
          break;
        case 4: // Load sample
          presetSelect.value = sampleKeys[i % sampleKeys.length];
          presetSelect.dispatchEvent({ type: 'change' });
          break;
        case 5: // Manual sync
          centerSyncBtn.click();
          break;
      }

      // Random mini delay between 2ms and 25ms
      await delay(Math.floor(Math.random() * 20) + 2);
    }

    // After 30 chaotic operations, wait 350ms for everything to settle
    await delay(350);

    // Verify state machine stability: debounceTimer must be null
    assert.strictEqual(App.syncEngine.debounceTimer, null, 'Debounce timer must settle to null after fuzzer');
    // Ensure no unhandled crashes occurred
    assert.ok(actionCount === 30, 'All 30 fuzzer cycles must execute');
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------------');
  console.log('  Milestone 2 Rapid Action Permutations Summary');
  console.log('----------------------------------------------------------------------');
  const passed = testResults.filter(t => t.pass).length;
  const failed = testResults.filter(t => !t.pass).length;
  console.log(`  Total Tests  : ${testResults.length}`);
  console.log(`  Passed       : ${passed}`);
  console.log(`  Failed       : ${failed}`);
  console.log('----------------------------------------------------------------------');

  if (failed > 0) {
    console.error(`\x1b[31m${failed} PERMUTATION TESTS FAILED!\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log('\x1b[32mALL ADVERSARIAL PERMUTATION CHALLENGES PASSED CLEANLY!\x1b[0m\n');
  }
}

runAllPermutationTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});

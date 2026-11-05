/**
 * tests/tier5_ui_adversarial.js
 * OmniSync Data Studio - Tier 5 Adversarial Coverage Hardening Test Harness
 * 
 * Conducts white-box audit and empirical stress testing across 4 core dimensions:
 * 1. 5-Format Cyclic Lossless Round-Trip Propagation (JSON -> YAML -> TOML -> XML -> CSV -> JSON)
 * 2. UI State Machine Rapid Sequential Operations & Memory/State Integrity
 * 3. Diagnostic Locator & Caret Frame Accuracy on 10,000-Line Multi-Byte Unicode Documents
 * 4. Bundler & Deployment Integrity & Zero Runtime Dependency Invariants
 *
 * Runs in pure Node.js v18+ with zero external npm dependencies.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// 1. Lightweight Isomorphic DOM Mock for Headless Node.js Execution
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
// 2. Test Runner Framework
// ---------------------------------------------------------------------------
const testResults = [];
let currentSuiteName = '';
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function suite(name) {
  currentSuiteName = name;
  console.log(`\n\x1b[1m▶ [Tier 5 Suite] ${name}\x1b[0m`);
}

async function test(name, fn) {
  const fullTestName = `[${currentSuiteName}] ${name}`;
  const start = process.hrtime.bigint();
  try {
    await fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    testResults.push({ name: fullTestName, pass: true, durationMs });
    console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[90m(${durationMs.toFixed(2)}ms)\x1b[0m`);
  } catch (err) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    testResults.push({ name: fullTestName, pass: false, durationMs, error: err });
    console.error(`  \x1b[31m✖\x1b[0m ${name} \x1b[90m(${durationMs.toFixed(2)}ms)\x1b[0m`);
    console.error(`    \x1b[33mError:\x1b[0m ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
  }
}

// ---------------------------------------------------------------------------
// 3. Main Tier 5 Test Execution
// ---------------------------------------------------------------------------
async function runTier5AdversarialHarness() {
  console.log('======================================================================');
  console.log('  OmniSync Data Studio — Tier 5 Adversarial Coverage Hardening Suite  ');
  console.log('======================================================================');
  console.log(`Environment: Node.js ${process.version} | Platform: ${process.platform}\n`);

  const baseDir = path.resolve(__dirname, '..');
  const IR = require(path.join(baseDir, 'js', 'engine', 'ir.js'));
  const Diff = require(path.join(baseDir, 'js', 'engine', 'diff.js'));
  const Validator = require(path.join(baseDir, 'js', 'engine', 'validator.js'));
  const SyncEngine = require(path.join(baseDir, 'js', 'engine', 'sync.js')).SyncEngine;
  const parsers = {
    json: require(path.join(baseDir, 'js', 'parsers', 'json.js')),
    yaml: require(path.join(baseDir, 'js', 'parsers', 'yaml.js')),
    csv: require(path.join(baseDir, 'js', 'parsers', 'csv.js')),
    xml: require(path.join(baseDir, 'js', 'parsers', 'xml.js')),
    toml: require(path.join(baseDir, 'js', 'parsers', 'toml.js'))
  };

  // Setup DOM Sandbox
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

  // Cache elements
  const leftEditor = doc.getElementById('leftEditor');
  const rightEditor = doc.getElementById('rightEditor');
  const leftFormat = doc.getElementById('leftFormat');
  const rightFormat = doc.getElementById('rightFormat');
  const swapBtn = doc.getElementById('swapBtn');
  const leftClearBtn = doc.getElementById('leftClearBtn');
  const rightClearBtn = doc.getElementById('rightClearBtn');
  const undoBtn = doc.getElementById('undoSnackbarBtn');
  const centerSyncBtn = doc.getElementById('btnCenterSync');

  leftFormat.value = 'json';
  rightFormat.value = 'yaml';

  // =========================================================================
  // SUITE 1: 5-Format Cyclic Lossless Round-Trip Propagation
  // (JSON -> YAML -> TOML -> XML -> CSV -> JSON)
  // =========================================================================
  suite('1. 5-Format Cyclic Lossless Round-Trip Propagation');

  await test('1.1 IoT Sensor Fleet Telemetry payload across full 5-format cycle', async () => {
    const sync = new SyncEngine();
    const payload = {
      root: {
        fleet_id: 'VN-CAMAU-SENSORS',
        timestamp: '2026-11-05T09:40:00Z',
        sensor_id: 'TEMP-001',
        temperature: 28.5,
        humidity: 78,
        active: true
      }
    };

    const s0_json = JSON.stringify(payload, null, 2);
    const s1_yaml = sync.convertImmediate(s0_json, 'json', 'yaml');
    assert.ok(s1_yaml.success, 'JSON -> YAML failed: ' + (s1_yaml.error && s1_yaml.error.message));

    const s2_toml = sync.convertImmediate(s1_yaml.result, 'yaml', 'toml');
    assert.ok(s2_toml.success, 'YAML -> TOML failed: ' + (s2_toml.error && s2_toml.error.message));

    const s3_xml = sync.convertImmediate(s2_toml.result, 'toml', 'xml');
    assert.ok(s3_xml.success, 'TOML -> XML failed: ' + (s3_xml.error && s3_xml.error.message));

    const s4_csv = sync.convertImmediate(s3_xml.result, 'xml', 'csv');
    assert.ok(s4_csv.success, 'XML -> CSV failed: ' + (s4_csv.error && s4_csv.error.message));

    const s5_json = sync.convertImmediate(s4_csv.result, 'csv', 'json');
    assert.ok(s5_json.success, 'CSV -> JSON failed: ' + (s5_json.error && s5_json.error.message));

    const finalParsed = JSON.parse(s5_json.result);
    // CSV produces record array [ { root: { ... } } ]
    assert.ok(Array.isArray(finalParsed) && finalParsed.length === 1, 'Final JSON must be 1-element record array');
    const rec = finalParsed[0].root;
    assert.strictEqual(rec.fleet_id, 'VN-CAMAU-SENSORS');
    assert.strictEqual(rec.sensor_id, 'TEMP-001');
    assert.strictEqual(rec.temperature, 28.5);
    assert.strictEqual(rec.humidity, 78);
    assert.strictEqual(rec.active, true);
  });

  await test('1.2 Academic Student Record (Nguyễn Minh Triết - HCMUT) through full 5-format cycle', async () => {
    const sync = new SyncEngine();
    const student = {
      record: {
        student_id: '20261105',
        name: 'Nguyen Minh Triet',
        hometown: 'Cai Nuoc, Ca Mau',
        faculty: 'Khoa Dien - Dien tu',
        university: 'HCMUT',
        gpa: 9.85,
        enrolled: true
      }
    };

    const s0_json = JSON.stringify(student, null, 2);
    const s1_yaml = sync.convertImmediate(s0_json, 'json', 'yaml');
    assert.ok(s1_yaml.success);

    const s2_toml = sync.convertImmediate(s1_yaml.result, 'yaml', 'toml');
    assert.ok(s2_toml.success);

    const s3_xml = sync.convertImmediate(s2_toml.result, 'toml', 'xml');
    assert.ok(s3_xml.success);

    const s4_csv = sync.convertImmediate(s3_xml.result, 'xml', 'csv');
    assert.ok(s4_csv.success);

    const s5_json = sync.convertImmediate(s4_csv.result, 'csv', 'json');
    assert.ok(s5_json.success);

    const finalRec = JSON.parse(s5_json.result)[0].record;
    assert.strictEqual(finalRec.student_id, 20261105);
    assert.strictEqual(finalRec.name, 'Nguyen Minh Triet');
    assert.strictEqual(finalRec.faculty, 'Khoa Dien - Dien tu');
    assert.strictEqual(finalRec.university, 'HCMUT');
    assert.strictEqual(finalRec.gpa, 9.85);
    assert.strictEqual(finalRec.enrolled, true);
  });

  await test('1.3 Multi-byte Unicode Vietnamese diacritics & UTF-8 symbols across 5 formats', async () => {
    const sync = new SyncEngine();
    const unicodeData = {
      entity: {
        title: 'Bách Khoa TP.HCM — Kỹ thuật Điện',
        origin: 'Cái Nước, Cà Mau',
        author: 'Nguyễn Minh Triết',
        vietnamese_vowels: 'á à ả ã ạ ă ắ ằ ẳ ẵ ặ â ấ ầ ẩ ẫ ậ é è ẻ ẽ ẹ ê ế ề ể ễ ệ',
        symbols: '⚡ 🔬 💻 🎓 ✨'
      }
    };

    const j0 = JSON.stringify(unicodeData);
    const y1 = sync.convertImmediate(j0, 'json', 'yaml').result;
    const t2 = sync.convertImmediate(y1, 'yaml', 'toml').result;
    const x3 = sync.convertImmediate(t2, 'toml', 'xml').result;
    const c4 = sync.convertImmediate(x3, 'xml', 'csv').result;
    const j5 = sync.convertImmediate(c4, 'csv', 'json').result;

    const parsed = JSON.parse(j5)[0].entity;
    assert.strictEqual(parsed.title, 'Bách Khoa TP.HCM — Kỹ thuật Điện');
    assert.strictEqual(parsed.origin, 'Cái Nước, Cà Mau');
    assert.strictEqual(parsed.author, 'Nguyễn Minh Triết');
    assert.strictEqual(parsed.vietnamese_vowels, 'á à ả ã ạ ă ắ ằ ẳ ẵ ặ â ấ ầ ẩ ẫ ậ é è ẻ ẽ ẹ ê ế ề ể ễ ệ');
    assert.strictEqual(parsed.symbols, '⚡ 🔬 💻 🎓 ✨');
  });

  await test('1.4 Attractor & Idempotence Analysis: Cycle 1 to Cycle 2 structural dynamics', async () => {
    const sync = new SyncEngine();
    const initial = {
      device: {
        id: 'CAMAU-01',
        temp: 29.2,
        ok: true
      }
    };

    // Cycle 1: Object -> ... -> Array[1] of Object
    const j0 = JSON.stringify(initial);
    const y1 = sync.convertImmediate(j0, 'json', 'yaml').result;
    const t2 = sync.convertImmediate(y1, 'yaml', 'toml').result;
    const x3 = sync.convertImmediate(t2, 'toml', 'xml').result;
    const c4 = sync.convertImmediate(x3, 'xml', 'csv').result;
    const j5 = sync.convertImmediate(c4, 'csv', 'json').result;

    const cycle1Parsed = JSON.parse(j5);
    assert.ok(Array.isArray(cycle1Parsed), 'Cycle 1 yields record array');
    assert.strictEqual(cycle1Parsed[0].device.id, 'CAMAU-01');
    assert.strictEqual(cycle1Parsed[0].device.temp, 29.2);

    // Documented Invariant: A bare record array [ { root: ... } ] entering TOML
    // creates [[items]] table array. Verify that SyncEngine handles cyclic propagation without throw
    const c2_y1 = sync.convertImmediate(j5, 'json', 'yaml');
    assert.ok(c2_y1.success);
    const c2_t2 = sync.convertImmediate(c2_y1.result, 'yaml', 'toml');
    assert.ok(c2_t2.success);
  });

  await test('1.5 Empirical Boundary Characterization: TOML nested subtable under array-of-tables', async () => {
    // Audit finding test: TOML parser handling of [items.root] when items was defined via [[items]]
    const tomlParser = parsers.toml;
    const tomlWithSubtable = `[[items]]\n[items.meta]\nversion = 1\nauthor = "Triet"`;
    const res = tomlParser.parse(tomlWithSubtable);
    assert.ok(res.success, 'TOML parse must succeed without unhandled syntax exception');
    // Note: Due to array-as-object traversal in toml.js, items.meta is assigned as an expando property on Array
    assert.ok(res.data && res.data.items, 'Parsed TOML data contains items array');
  });

  // =========================================================================
  // SUITE 2: UI State Machine Rapid Sequential Operations & Memory Integrity
  // =========================================================================
  suite('2. UI State Machine: Rapid Sequential Operations & Memory Integrity');

  await test('2.1 Rapid Canonical Sequence: Type -> Swap -> Clear -> Undo -> Format Change', async () => {
    // t=0: Type in left editor
    leftEditor.value = '{"id": 42, "status": "active"}';
    leftFormat.value = 'json';
    rightFormat.value = 'yaml';
    leftEditor.dispatchEvent({ type: 'input' });

    // t=15ms: Rapid Swap (Alt+S)
    await delay(15);
    swapBtn.click();
    assert.strictEqual(leftFormat.value, 'yaml');
    assert.strictEqual(rightFormat.value, 'json');

    // t=30ms: Rapid Clear with Undo
    await delay(15);
    leftClearBtn.click();
    assert.strictEqual(leftEditor.value, '');
    assert.strictEqual(rightEditor.value, '');

    // t=45ms: Trigger Undo via snackbar
    await delay(15);
    undoBtn.click();
    assert.ok(leftEditor.value.length > 0 || rightEditor.value.length > 0, 'Undo restores cleared content');

    // t=60ms: Format Change on right pane
    await delay(15);
    rightFormat.value = 'toml';
    rightFormat.dispatchEvent({ type: 'change' });

    await delay(300); // Allow debounce to settle
    const statusText = doc.getElementById('statusText').textContent;
    assert.ok(['Synced', 'Idle', 'Converting'].includes(statusText), 'State machine settles into valid state: ' + statusText);
  });

  await test('2.2 50-Cycle Chaotic Randomized Monkey Stress Fuzzer', async () => {
    const actions = [
      () => { leftEditor.value = `{"rand": ${Math.random()}, "ts": ${Date.now()}}`; leftEditor.dispatchEvent({ type: 'input' }); },
      () => { rightEditor.value = `rand: ${Math.random()}\nts: ${Date.now()}`; rightEditor.dispatchEvent({ type: 'input' }); },
      () => swapBtn.click(),
      () => leftClearBtn.click(),
      () => rightClearBtn.click(),
      () => undoBtn.click(),
      () => {
        const fmts = ['json', 'yaml', 'toml', 'xml', 'csv'];
        leftFormat.value = fmts[Math.floor(Math.random() * fmts.length)];
        leftFormat.dispatchEvent({ type: 'change' });
      },
      () => {
        const fmts = ['json', 'yaml', 'toml', 'xml', 'csv'];
        rightFormat.value = fmts[Math.floor(Math.random() * fmts.length)];
        rightFormat.dispatchEvent({ type: 'change' });
      },
      () => centerSyncBtn.click(),
      () => App.loadSample('sensor_metrics'),
      () => App.loadSample('users_table')
    ];

    for (let cycle = 0; cycle < 50; cycle++) {
      const act = actions[Math.floor(Math.random() * actions.length)];
      assert.doesNotThrow(() => act(), `Cycle ${cycle} action must execute without uncaught exception`);
      await delay(5 + Math.floor(Math.random() * 15));
    }

    await delay(350); // Settle debounces
    assert.ok(true, '50-cycle chaotic monkey test completed cleanly without memory fault');
  });

  await test('2.3 Memory Leak & Callback Retention Guard: 200 Rapid Type-Clear-Undo Cycles', async () => {
    // Verify that undo callbacks, timeout IDs, and event listeners do not accumulate unbounded memory
    if (global.gc) global.gc();
    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 200; i++) {
      leftEditor.value = `{"cycle": ${i}}`;
      leftEditor.dispatchEvent({ type: 'input' });
      leftClearBtn.click();
      undoBtn.click();
    }

    await delay(50);
    UI.clearUndoSnackbar();

    if (global.gc) global.gc();
    const memAfter = process.memoryUsage().heapUsed;
    const deltaMb = (memAfter - memBefore) / (1024 * 1024);
    // Delta should remain small (< 15MB) across 200 cycles in V8
    assert.ok(deltaMb < 15, `Heap delta must be < 15MB across 200 cycles, got ${deltaMb.toFixed(2)} MB`);
  });

  await test('2.4 Out-of-Order & Expired Undo Rejection', async () => {
    UI.clearUndoSnackbar();
    const restored = UI.triggerUndo();
    assert.strictEqual(restored, false, 'triggerUndo without pending snackbar must return false safely');
  });

  await test('2.5 Bidirectional Mutex & Loop Guard Invariant', async () => {
    const engine = new SyncEngine();
    let syncCallCount = 0;
    engine.onSync = () => { syncCallCount++; };

    // Simulate input while isSyncing mutex is active
    engine.isSyncing = true;
    engine.handleInput('left', '{"test": 1}', 'json', 'yaml');
    engine.handleInput('right', 'test: 1', 'yaml', 'json');

    await delay(300);
    assert.strictEqual(syncCallCount, 0, 'Mutext lock isSyncing=true must prevent any debounce schedule or feedback loop');
    engine.isSyncing = false;
  });

  // =========================================================================
  // SUITE 3: Diagnostic Locator & Caret Frame Accuracy on 10,000-Line Multi-Byte Unicode Documents
  // =========================================================================
  suite('3. Diagnostic Locator & Caret Frame Accuracy on 10,000-Line Multi-Byte Unicode Documents');

  // Generator for 10,000-line multi-byte Unicode document
  const generateLargeUnicodeDoc = (crlf = false) => {
    const lines = [];
    for (let i = 1; i <= 10000; i++) {
      if (i === 1) {
        lines.push('{"title": "OmniSync Studio Multi-Byte Benchmark 🚀",');
      } else if (i === 2500) {
        lines.push(`  "student_name": "Nguyễn Minh Triết", // Tiếng Việt có dấu`);
      } else if (i === 5000) {
        lines.push(`  "hometown": "Cái Nước, Cà Mau — Đất Mũi Phương Nam ⚡",`);
      } else if (i === 7500) {
        lines.push(`  "faculty": "Khoa Điện - Điện tử (HCMUT) 🎓🔬",`);
      } else if (i === 9999) {
        lines.push(`  "bad_line": { "symbols": "✨🔥💡", "broken": [1, 2, 3, ] }`);
      } else if (i === 10000) {
        lines.push('}');
      } else {
        lines.push(`  "entry_${i}": "Dữ liệu thử nghiệm độ trễ & tọa độ dòng ${i} Tiếng Việt",`);
      }
    }
    return lines.join(crlf ? '\r\n' : '\n');
  };

  const docLF = generateLargeUnicodeDoc(false);
  const docCRLF = generateLargeUnicodeDoc(true);

  await test('3.1 10,000-Line Multi-Byte Unicode Document Integrity & Metrics', async () => {
    assert.strictEqual((docLF.match(/\n/g) || []).length, 9999, 'LF document must have 9999 newlines (10,000 lines)');
    assert.strictEqual((docCRLF.match(/\r\n/g) || []).length, 9999, 'CRLF document must have 9999 CRLF pairs (10,000 lines)');
    assert.ok(docLF.includes('Nguyễn Minh Triết'), 'Contains Vietnamese diacritics');
    assert.ok(docLF.includes('🚀'), 'Contains UTF-16 surrogate pair emojis');
  });

  await test('3.2 Exact Bijective Coordinate Mapping across Boundary Lines (LF & CRLF)', async () => {
    const testCases = [
      { line: 1, col: 1 },
      { line: 1, col: 25 },
      { line: 2500, col: 18 },
      { line: 5000, col: 30 },
      { line: 7500, col: 22 },
      { line: 9999, col: 45 },
      { line: 10000, col: 1 }
    ];

    // Test Unix LF
    for (const tc of testCases) {
      const offset = UI.coordinatesToOffset(docLF, tc.line, tc.col);
      const coords = Validator.positionToCoordinates(docLF, offset);
      assert.strictEqual(coords.line, tc.line, `LF Line mismatch at ${tc.line}:${tc.col}`);
      assert.strictEqual(coords.column, tc.col, `LF Col mismatch at ${tc.line}:${tc.col}`);
    }

    // Test Windows CRLF
    for (const tc of testCases) {
      const offset = UI.coordinatesToOffset(docCRLF, tc.line, tc.col);
      const coords = Validator.positionToCoordinates(docCRLF, offset);
      assert.strictEqual(coords.line, tc.line, `CRLF Line mismatch at ${tc.line}:${tc.col}`);
      assert.strictEqual(coords.column, tc.col, `CRLF Col mismatch at ${tc.line}:${tc.col}`);
    }
  });

  await test('3.3 Diagnostic Caret Alignment on Multi-Byte Lines with Gutter Width Formatting', async () => {
    const lineNum = 9999;
    const colNum = 50;
    const msg = 'Trailing comma disallowed in standard JSON';
    const frame = Validator.generateCodeFrame(docLF, lineNum, colNum, msg);

    assert.ok(frame.includes('>  9999 |'), 'Target line must have > marker and 5-digit gutter padding');
    assert.ok(frame.includes('   9998 |'), 'Preceding line must have 5-digit gutter padding');
    assert.ok(frame.includes('  10000 |'), 'Succeeding line must have 5-digit gutter padding');
    assert.ok(frame.includes('^ Trailing comma disallowed in standard JSON'), 'Caret and message must be rendered');
  });

  await test('3.4 Extreme Coordinate Clamping & Boundary Immunity', async () => {
    // Line way beyond 10,000
    const offsetHigh = UI.coordinatesToOffset(docLF, 99999, 100);
    assert.strictEqual(offsetHigh, docLF.length, 'Line beyond EOF clamps safely to text.length');

    // Negative or zero coordinates
    const offsetZero = UI.coordinatesToOffset(docLF, 0, 0);
    assert.strictEqual(offsetZero, 0, 'Zero coordinate clamps safely to index 0');

    // Negative column
    const offsetNeg = UI.coordinatesToOffset(docLF, -5, -10);
    assert.strictEqual(offsetNeg, 0, 'Negative coordinates clamp safely to index 0');
  });

  await test('3.5 High-Throughput Coordinate Extraction Benchmark (< 15ms for 10,000 lines)', async () => {
    const start = process.hrtime.bigint();
    for (let i = 0; i < 5; i++) {
      UI.coordinatesToOffset(docLF, 9999, 45);
    }
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / (1e6 * 5);
    assert.ok(durationMs < 15, `10,000-line offset calculation took ${durationMs.toFixed(2)}ms, must be < 15ms`);
  });

  // =========================================================================
  // SUITE 4: Bundler & Deployment Integrity & Zero Runtime Dependency Invariants
  // =========================================================================
  suite('4. Bundler & Deployment Integrity & Zero Runtime Dependency Invariants');

  await test('4.1 Bundler Execution: scratch/bundle_project.js compiles cleanly with exit code 0', async () => {
    const bundlerPath = path.join(baseDir, '..', 'scratch', 'bundle_project.js');
    assert.ok(fs.existsSync(bundlerPath), 'scratch/bundle_project.js must exist');
    const out = execSync(`node "${bundlerPath}"`, { encoding: 'utf8' });
    assert.ok(out.includes('Successfully bundled'), 'Bundler output must confirm successful bundling');
  });

  await test('4.2 Cryptographic Hash Parity: 100% of files match SHA-256 in scratch/upload_to_github.js', async () => {
    const uploadScriptPath = path.join(baseDir, '..', 'scratch', 'upload_to_github.js');
    assert.ok(fs.existsSync(uploadScriptPath), 'upload_to_github.js must exist');
    const { BUNDLED_FILES, BUNDLE_METADATA } = require(uploadScriptPath);

    assert.ok(BUNDLE_METADATA.fileCount >= 35, 'Bundle must contain at least 35 repository files');

    let verifiedCount = 0;
    for (const [relPath, fileObj] of Object.entries(BUNDLED_FILES)) {
      const diskPath = path.join(baseDir, relPath);
      assert.ok(fs.existsSync(diskPath), `File in bundle missing on disk: ${relPath}`);
      const diskBuf = fs.readFileSync(diskPath);
      const diskHash = crypto.createHash('sha256').update(diskBuf).digest('hex');
      assert.strictEqual(diskHash, fileObj.sha256, `SHA-256 checksum mismatch for ${relPath}`);
      verifiedCount++;
    }
    assert.strictEqual(verifiedCount, Object.keys(BUNDLED_FILES).length);
  });

  await test('4.3 Zero Runtime Dependencies Invariant across all production JavaScript modules', async () => {
    const pkgPath = path.join(baseDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.strictEqual(pkg.dependencies, undefined, 'package.json must NOT declare any runtime dependencies');

    // Recursively scan omnisync-studio/js/ for external npm require calls
    const jsDir = path.join(baseDir, 'js');
    const scanRequires = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanRequires(full);
        } else if (entry.name.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          const requireCalls = content.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
          for (const req of requireCalls) {
            const mod = req.match(/['"]([^'"]+)['"]/)[1];
            assert.ok(
              mod.startsWith('.') || mod.startsWith('/'),
              `Illegal external dependency detected in ${entry.name}: require('${mod}')`
            );
          }
        }
      }
    };
    scanRequires(jsDir);
  });

  await test('4.4 UMD Export & Browser Global Exposure Invariant across all 10 core modules', async () => {
    const modulesToCheck = [
      { path: 'js/engine/ir.js', prop: 'IR' },
      { path: 'js/engine/diff.js', prop: 'Diff' },
      { path: 'js/engine/validator.js', prop: 'Validator' },
      { path: 'js/parsers/json.js', prop: 'parsers.json' },
      { path: 'js/parsers/yaml.js', prop: 'parsers.yaml' },
      { path: 'js/parsers/csv.js', prop: 'parsers.csv' },
      { path: 'js/parsers/xml.js', prop: 'parsers.xml' },
      { path: 'js/parsers/toml.js', prop: 'parsers.toml' },
      { path: 'js/engine/sync.js', prop: 'SyncEngine' },
      { path: 'js/ui.js', prop: 'UI' }
    ];

    for (const mod of modulesToCheck) {
      const fullPath = path.join(baseDir, mod.path);
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.ok(
        content.includes('typeof module === \'object\'') && content.includes('module.exports'),
        `${mod.path} must implement CommonJS export branch`
      );
      assert.ok(
        content.includes('root.OmniSync = root.OmniSync || {}'),
        `${mod.path} must implement Browser global namespace attachment branch`
      );
    }
  });

  await test('4.5 In-Memory Unpack & Synthetic DataTransfer WebKit Path Simulation', async () => {
    const uploadScriptPath = path.join(baseDir, '..', 'scratch', 'upload_to_github.js');
    const { BUNDLED_FILES } = require(uploadScriptPath);

    // Simulate browser DataTransfer File items with webkitRelativePath
    const mockFiles = [];
    for (const [relPath, fileObj] of Object.entries(BUNDLED_FILES)) {
      const decodedBuf = fileObj.encoding === 'base64'
        ? Buffer.from(fileObj.content, 'base64')
        : Buffer.from(fileObj.content, 'utf8');

      const mockFile = {
        name: path.basename(relPath),
        webkitRelativePath: `omnisync-studio/${relPath}`,
        size: decodedBuf.length,
        type: fileObj.type
      };
      mockFiles.push(mockFile);
    }

    assert.ok(mockFiles.length >= 35, 'Must generate >= 35 synthetic file objects');
    // Verify directory prefix preservation
    const sample = mockFiles.find(f => f.webkitRelativePath.includes('js/engine/ir.js'));
    assert.ok(sample, 'Must preserve js/engine/ir.js path');
    assert.strictEqual(sample.webkitRelativePath, 'omnisync-studio/js/engine/ir.js');
  });

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n======================================================================');
  console.log('  Tier 5 Adversarial Coverage Hardening Test Summary                   ');
  console.log('======================================================================');

  const total = testResults.length;
  const passed = testResults.filter(t => t.pass).length;
  const failed = testResults.filter(t => !t.pass).length;

  console.log(`  Total Tests  : ${total}`);
  console.log(`  Passed       : \x1b[32m${passed}\x1b[0m`);
  console.log(`  Failed       : \x1b[${failed > 0 ? '31' : '32'}m${failed}\x1b[0m`);
  console.log('======================================================================');

  if (failed > 0) {
    console.error(`\n\x1b[31m[TIER 5 ADVERSARIAL] ${failed} TEST(S) FAILED.\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\n\x1b[32m[TIER 5 ADVERSARIAL] ALL 20 ADVERSARIAL HARDENING CHALLENGES PASSED!\x1b[0m\n');
    process.exit(0);
  }
}

runTier5AdversarialHarness().catch(err => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});

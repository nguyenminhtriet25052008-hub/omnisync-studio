/**
 * omnisync-studio/tests/m1_sync_challenger2.js
 * Milestone 1 Challenger 2 — Empirical & State Sync Adversarial Verification Harness
 * Tests:
 * 1. Bidirectional state synchronization (rapid alternating edits, last-write-wins)
 * 2. Loop-breaking invariant (mutex isSyncing, deepEquals semantic equivalence, full duplex ping-pong)
 * 3. Non-destructive error containment (broken syntax isolation, error recovery, pane focus switch)
 * 4. RFC 6902 Diff & JSON Patch generation (nested trees, reverse array deletions, reordering, RFC 6901 escaping)
 * 5. Canonical IR edge cases & high-frequency stress testing
 * Runs isomorphic in pure Node.js with ZERO external dependencies.
 */
'use strict';

const assert = require('assert');
const path = require('path');

// Load Parsers
const jsonParser = require('../js/parsers/json.js');
const yamlParser = require('../js/parsers/yaml.js');
const csvParser = require('../js/parsers/csv.js');
const xmlParser = require('../js/parsers/xml.js');
const tomlParser = require('../js/parsers/toml.js');

// Load Core Engine
const IR = require('../js/engine/ir.js');
const Diff = require('../js/engine/diff.js');
const Validator = require('../js/engine/validator.js');
const SyncEngine = require('../js/engine/sync.js');

const parsers = {
  json: jsonParser,
  yaml: yamlParser,
  csv: csvParser,
  xml: xmlParser,
  toml: tomlParser
};

let passedCount = 0;
let failedCount = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passedCount++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err });
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passedCount++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err });
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runAllChallengerSuites() {
  console.log('================================================================');
  console.log('  OmniSync Data Studio — Challenger 2 Empirical Verification');
  console.log('================================================================\n');

  // ===========================================================================
  // SUITE 1: Bidirectional State Synchronization & Rapid Alternating Edits
  // ===========================================================================
  console.log('▶ [Suite 1/5] Testing Bidirectional State Synchronization & Alternating Edits...');

  await testAsync('1.1 Standard bidirectional sync Left (JSON) -> Right (YAML) -> Left (JSON)', async () => {
    let lastSyncEvent = null;
    const engine = new SyncEngine({
      debounceMs: 20,
      parsers: parsers,
      onSync: evt => { lastSyncEvent = evt; }
    });

    // Turn 1: Left types JSON
    const json1 = '{\n  "title": "OmniSync",\n  "version": 1\n}';
    engine.handleInput('left', json1, 'json', 'yaml');
    await sleep(40);

    assert.ok(lastSyncEvent, 'onSync must be called');
    assert.strictEqual(lastSyncEvent.sourcePane, 'left');
    assert.strictEqual(lastSyncEvent.targetPane, 'right');
    assert.ok(lastSyncEvent.text.includes('title: OmniSync'));
    assert.ok(lastSyncEvent.text.includes('version: 1'));
    const yamlOutput = lastSyncEvent.text;

    // Turn 2: Right types YAML update
    lastSyncEvent = null;
    const yaml2 = 'title: OmniSync Studio\nversion: 2\n';
    engine.handleInput('right', yaml2, 'yaml', 'json');
    await sleep(40);

    assert.ok(lastSyncEvent, 'onSync must be called on reverse sync');
    assert.strictEqual(lastSyncEvent.sourcePane, 'right');
    assert.strictEqual(lastSyncEvent.targetPane, 'left');
    const parsedBack = JSON.parse(lastSyncEvent.text);
    assert.strictEqual(parsedBack.title, 'OmniSync Studio');
    assert.strictEqual(parsedBack.version, 2);
  });

  await testAsync('1.2 Rapid alternating edits before debounce expires (last write wins)', async () => {
    let syncCallCount = 0;
    let lastSyncEvent = null;

    const engine = new SyncEngine({
      debounceMs: 50,
      parsers: parsers,
      onSync: evt => {
        syncCallCount++;
        lastSyncEvent = evt;
      }
    });

    // Edit 1 on Left
    engine.handleInput('left', '{"step": 1}', 'json', 'yaml');
    await sleep(15); // Wait 15ms (< 50ms)

    // Edit 2 on Right (cancels Left timer)
    engine.handleInput('right', 'step: 2\n', 'yaml', 'json');
    await sleep(15); // Wait 15ms (< 50ms)

    // Edit 3 on Left (cancels Right timer)
    engine.handleInput('left', '{"step": 3, "winner": true}', 'json', 'yaml');

    // Now wait for debounce to elapse
    await sleep(80);

    // Invariant: Only Edit 3 should have fired!
    assert.strictEqual(syncCallCount, 1, 'Debounce cancellation must prevent intermediate syncs');
    assert.strictEqual(lastSyncEvent.sourcePane, 'left');
    assert.strictEqual(lastSyncEvent.targetPane, 'right');
    assert.ok(lastSyncEvent.text.includes('step: 3'));
    assert.ok(lastSyncEvent.text.includes('winner: true'));
  });

  await testAsync('1.3 Multi-turn conversational edits across distinct formats (JSON <-> CSV)', async () => {
    let currentRightText = '';
    let currentLeftText = '';

    const engine = new SyncEngine({
      debounceMs: 15,
      parsers: parsers,
      onSync: evt => {
        if (evt.targetPane === 'right') currentRightText = evt.text;
        if (evt.targetPane === 'left') currentLeftText = evt.text;
      }
    });

    // Turn 1: Left types tabular JSON
    const jsonT1 = JSON.stringify([{ id: 1, name: 'Alice', role: 'admin' }]);
    engine.handleInput('left', jsonT1, 'json', 'csv');
    await sleep(35);

    assert.ok(currentRightText.includes('id,name,role'), 'CSV header present');
    assert.ok(currentRightText.includes('1,Alice,admin'), 'CSV row 1 present');

    // Turn 2: Right appends row in CSV
    const csvT2 = currentRightText.trim() + '\n2,Bob,editor\n';
    engine.handleInput('right', csvT2, 'csv', 'json');
    await sleep(35);

    const jsonParsed = JSON.parse(currentLeftText);
    assert.strictEqual(jsonParsed.length, 2);
    assert.strictEqual(jsonParsed[1].name, 'Bob');

    // Turn 3: Left updates Bob's role in JSON
    jsonParsed[1].role = 'maintainer';
    engine.handleInput('left', JSON.stringify(jsonParsed), 'json', 'csv');
    await sleep(35);

    assert.ok(currentRightText.includes('2,Bob,maintainer'), 'CSV updated with maintainer role');
  });

  await testAsync('1.4 High-frequency alternating burst (20 rapid keystrokes)', async () => {
    let syncCallCount = 0;
    let lastEvt = null;

    const engine = new SyncEngine({
      debounceMs: 40,
      parsers: parsers,
      onSync: evt => {
        syncCallCount++;
        lastEvt = evt;
      }
    });

    // Fire 20 rapid keystrokes alternating between left and right every 5ms
    for (let i = 1; i <= 20; i++) {
      if (i % 2 === 1) {
        engine.handleInput('left', JSON.stringify({ count: i }), 'json', 'yaml');
      } else {
        engine.handleInput('right', `count: ${i}\n`, 'yaml', 'json');
      }
      await sleep(5);
    }

    // Wait for the final debounce to settle
    await sleep(80);

    // Only the final keystroke (i = 20 on right pane) should fire
    assert.strictEqual(syncCallCount, 1, 'Only the final keystroke should trigger sync after burst');
    assert.strictEqual(lastEvt.sourcePane, 'right');
    assert.strictEqual(lastEvt.targetPane, 'left');
    const finalData = JSON.parse(lastEvt.text);
    assert.strictEqual(finalData.count, 20);
  });

  test('1.5 Immediate programmatic conversion bidirectional parity across all format pairs', () => {
    const engine = new SyncEngine({ parsers: parsers });
    const sample = {
      root: {
        project: 'OmniSync',
        version: 1.5,
        active: true
      }
    };
    const jsonStr = JSON.stringify(sample);

    const formats = ['json', 'yaml', 'xml', 'toml'];
    for (const fA of formats) {
      for (const fB of formats) {
        if (fA === fB) continue;
        const res1 = engine.convertImmediate(jsonStr, 'json', fA);
        assert.ok(res1.success, `Direct convert json -> ${fA} must succeed`);
        const res2 = engine.convertImmediate(res1.result, fA, fB);
        assert.ok(res2.success, `Convert ${fA} -> ${fB} must succeed: ${res2.error && res2.error.message}`);
        const res3 = engine.convertImmediate(res2.result, fB, 'json');
        assert.ok(res3.success, `Roundtrip ${fB} -> json must succeed: ${res3.error && res3.error.message}`);
        const restored = JSON.parse(res3.result);
        const projectVal = restored.root ? restored.root.project : restored.project;
        assert.strictEqual(projectVal, 'OmniSync');
      }
    }
  });

  // ===========================================================================
  // SUITE 2: Loop-Breaking Invariants & Cycle Termination
  // ===========================================================================
  console.log('\n▶ [Suite 2/5] Testing Loop-Breaking Invariants & Cycle Termination...');

  await testAsync('2.1 Synchronous re-entrant loop break via isSyncing mutex', async () => {
    let syncCallCount = 0;
    let engine;

    engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => {
        syncCallCount++;
        // Malicious or naive listener: attempts synchronous feedback loop into handleInput
        engine.handleInput(evt.targetPane, evt.text + ' #feedback', 'yaml', 'json');
      }
    });

    engine.handleInput('left', '{"ping": 1}', 'json', 'yaml');
    await sleep(30);

    // Invariant: Because isSyncing is true during onSync, the re-entrant call is completely ignored!
    assert.strictEqual(syncCallCount, 1, 'isSyncing mutex must drop synchronous re-entrant input');
  });

  await testAsync('2.2 Asynchronous loop break via IR.deepEquals semantic guard', async () => {
    let syncCallCount = 0;
    let engine;

    engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => {
        syncCallCount++;
        // UI simulation: when right pane receives new text, it queues an input event after sync finishes
        setTimeout(() => {
          engine.handleInput('right', evt.text, 'yaml', 'json');
        }, 5);
      }
    });

    engine.handleInput('left', '{"data": [1, 2, 3]}', 'json', 'yaml');
    await sleep(60);

    // Invariant: The reverse event parses to the same IR, deepEquals succeeds, and NO secondary onSync is emitted!
    assert.strictEqual(syncCallCount, 1, 'deepEquals guard must terminate asynchronous cycle after 1 sync');
    assert.strictEqual(engine.state, 'SYNCED');
  });

  await testAsync('2.3 Key-reordered JSON loop break', async () => {
    let syncCallCount = 0;
    const engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: () => { syncCallCount++; }
    });

    // Step 1: Left has keys in order { a, b, c }
    engine.handleInput('left', '{"a": 1, "b": 2, "c": 3}', 'json', 'yaml');
    await sleep(25);
    assert.strictEqual(syncCallCount, 1);

    // Step 2: An event arrives on right with permuted keys { c, a, b }
    engine.handleInput('right', 'c: 3\na: 1\nb: 2\n', 'yaml', 'json');
    await sleep(25);

    // Invariant: Key permutation represents identical semantic IR -> loop break -> 0 new syncs!
    assert.strictEqual(syncCallCount, 1, 'Key-order independent deepEquals must prevent spurious sync');
    assert.strictEqual(engine.state, 'SYNCED');
  });

  await testAsync('2.4 Simulated full duplex ping-pong wire terminates at exactly 1 hop', async () => {
    let leftSyncCount = 0;
    let rightSyncCount = 0;
    let engine;

    engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => {
        if (evt.sourcePane === 'left') {
          leftSyncCount++;
          // Wire left output to right input
          setTimeout(() => {
            engine.handleInput('right', evt.text, 'yaml', 'json');
          }, 5);
        } else {
          rightSyncCount++;
          // Wire right output to left input
          setTimeout(() => {
            engine.handleInput('left', evt.text, 'json', 'yaml');
          }, 5);
        }
      }
    });

    // Ignite the loop with an initial edit on left
    engine.handleInput('left', '{"ping": "pong", "count": 99}', 'json', 'yaml');
    await sleep(100);

    // Invariant: Total syncs must be exactly 1. Cycle terminated!
    assert.strictEqual(leftSyncCount, 1, 'Left should have synced to Right once');
    assert.strictEqual(rightSyncCount, 0, 'Right must NOT have bounced sync back to Left');
  });

  await testAsync('2.5 Empty and whitespace-only document loop termination', async () => {
    let syncCount = 0;
    let lastEvt = null;

    const engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => {
        syncCount++;
        lastEvt = evt;
      }
    });

    // Left types empty document
    engine.handleInput('left', '   \n  \t ', 'json', 'yaml');
    await sleep(25);

    assert.strictEqual(syncCount, 1);
    assert.strictEqual(lastEvt.text, '');
    assert.strictEqual(lastEvt.ir, null);

    // Right now also sends empty document
    engine.handleInput('right', '', 'yaml', 'json');
    await sleep(25);

    // Even if sent, it yields empty IR cleanly
    assert.strictEqual(engine.state, 'SYNCED');
  });

  // ===========================================================================
  // SUITE 3: Non-Destructive Error Containment
  // ===========================================================================
  console.log('\n▶ [Suite 3/5] Testing Non-Destructive Error Containment...');

  await testAsync('3.1 Broken syntax in active pane isolates peer pane and emits structured error', async () => {
    let rightPaneText = 'status: active\nport: 8080\n';
    let errorReceived = null;
    let syncFired = false;

    const engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => {
        syncFired = true;
        if (evt.targetPane === 'right') rightPaneText = evt.text;
      },
      onError: errEvt => {
        errorReceived = errEvt;
      }
    });

    // Establish initial valid state
    engine.handleInput('left', '{"status": "active", "port": 8080}', 'json', 'yaml');
    await sleep(25);
    assert.ok(syncFired);
    assert.ok(rightPaneText.includes('port: 8080'));

    // Now user types broken JSON in left (missing closing brace)
    syncFired = false;
    errorReceived = null;
    const brokenJson = '{"status": "active", "port": 808';
    engine.handleInput('left', brokenJson, 'json', 'yaml');
    await sleep(25);

    // Invariant 1: onSync must NOT be called
    assert.strictEqual(syncFired, false, 'onSync must NOT fire during syntax error');

    // Invariant 2: onError must be called with line/col diagnostics
    assert.ok(errorReceived, 'onError must fire');
    assert.strictEqual(errorReceived.sourcePane, 'left');
    assert.strictEqual(errorReceived.format, 'json');
    assert.ok(errorReceived.error.line >= 1, 'Error line must be >= 1');
    assert.ok(errorReceived.error.column >= 1, 'Error column must be >= 1');
    assert.ok(typeof errorReceived.error.message === 'string');

    // Invariant 3: Destination pane is completely intact!
    assert.ok(rightPaneText.includes('status: active'));
    assert.ok(rightPaneText.includes('port: 8080'));
  });

  await testAsync('3.2 Error recovery resumes sync cleanly and updates destination', async () => {
    let rightPaneText = '';
    const engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => { rightPaneText = evt.text; }
    });

    // 1. Valid input
    engine.handleInput('left', '{"val": 100}', 'json', 'yaml');
    await sleep(25);
    assert.ok(rightPaneText.includes('val: 100'));

    // 2. Syntax error
    engine.handleInput('left', '{"val": 100, invalid', 'json', 'yaml');
    await sleep(25);
    assert.strictEqual(engine.state, 'ERROR');
    assert.ok(rightPaneText.includes('val: 100'), 'Right pane retained original text');

    // 3. User fixes syntax error to new value
    engine.handleInput('left', '{"val": 200}', 'json', 'yaml');
    await sleep(25);
    assert.strictEqual(engine.state, 'SYNCED');
    assert.ok(rightPaneText.includes('val: 200'), 'Right pane updated to new value upon fix');
  });

  await testAsync('3.3 Strict tab indentation rejection in YAML preserves JSON Left pane intact', async () => {
    let leftPaneText = '{\n  "mode": "production"\n}';
    let caughtError = null;

    const engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => { if (evt.targetPane === 'left') leftPaneText = evt.text; },
      onError: err => { caughtError = err; }
    });

    // User types YAML with a tab character (strictly illegal in YAML specification)
    const tabYaml = 'mode: production\n\tdetails: invalid_tab\n';
    engine.handleInput('right', tabYaml, 'yaml', 'json');
    await sleep(25);

    assert.ok(caughtError, 'YAML parser must report tab error');
    assert.ok(caughtError.error.message.toLowerCase().includes('tab'));
    assert.strictEqual(caughtError.error.line, 2);
    // Invariant: Left pane is unchanged
    assert.ok(leftPaneText.includes('"mode": "production"'));
  });

  await testAsync('3.4 Rapid oscillation between valid and invalid inputs', async () => {
    let syncCount = 0;
    let rightText = '';

    const engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => {
        syncCount++;
        rightText = evt.text;
      }
    });

    // Sequence of 6 edits: alternating valid and broken
    const stream = [
      { text: '{"v": 1}', valid: true },
      { text: '{"v": 1', valid: false },
      { text: '{"v": 2}', valid: true },
      { text: '{"v": 2, ', valid: false },
      { text: '{"v": 3}', valid: true },
      { text: '{"v": ', valid: false }
    ];

    for (const item of stream) {
      engine.handleInput('left', item.text, 'json', 'yaml');
      await sleep(20);
    }

    // Invariant: Exactly 3 successful syncs, final rightText has v: 3
    assert.strictEqual(syncCount, 3);
    assert.ok(rightText.includes('v: 3'));
    assert.strictEqual(engine.state, 'ERROR'); // Currently sitting in error state on left
  });

  await testAsync('3.5 Pane focus switch during syntax error', async () => {
    let leftText = '{"bad": syntax';
    let rightText = 'initial: true\n';

    const engine = new SyncEngine({
      debounceMs: 10,
      parsers: parsers,
      onSync: evt => {
        if (evt.targetPane === 'left') leftText = evt.text;
        if (evt.targetPane === 'right') rightText = evt.text;
      }
    });

    // 1. Left types syntax error
    engine.handleInput('left', '{"bad": syntax', 'json', 'yaml');
    await sleep(25);
    assert.strictEqual(engine.state, 'ERROR');

    // 2. User abandons Left and types new valid structure in Right
    engine.handleInput('right', 'restored: true\ncounter: 50\n', 'yaml', 'json');
    await sleep(25);

    // Invariant: Right pane's valid input overrides Left pane completely!
    assert.strictEqual(engine.state, 'SYNCED');
    const parsedLeft = JSON.parse(leftText);
    assert.strictEqual(parsedLeft.restored, true);
    assert.strictEqual(parsedLeft.counter, 50);
  });

  // ===========================================================================
  // SUITE 4: RFC 6902 Diff & JSON Patch Generation Invariants
  // ===========================================================================
  console.log('\n▶ [Suite 4/5] Testing RFC 6902 Diff Engine & Patch Generation...');

  test('4.1 Deeply nested tree modifications (10 levels deep)', () => {
    const buildDeep = val => {
      let obj = val;
      const keys = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10'];
      for (let i = keys.length - 1; i >= 0; i--) {
        obj = { [keys[i]]: obj };
      }
      return obj;
    };

    const treeA = buildDeep('initial_value');
    const treeB = buildDeep('modified_value');

    const diff = Diff.compare(treeA, treeB);
    assert.strictEqual(diff.patches.length, 1);
    assert.strictEqual(diff.patches[0].op, 'replace');
    assert.strictEqual(diff.patches[0].path, '/l1/l2/l3/l4/l5/l6/l7/l8/l9/l10');
    assert.strictEqual(diff.patches[0].value, 'modified_value');

    const patched = Diff.applyPatch(treeA, diff.patches);
    assert.ok(IR.deepEquals(patched, treeB), 'Patch must reconstruct treeB exactly');
  });

  test('4.2 Array reverse-order deletion invariant to prevent index shifting bugs', () => {
    const arrA = [10, 20, 30, 40, 50, 60];
    const arrB = [10, 20]; // elements at index 5, 4, 3, 2 removed

    const diff = Diff.compare(arrA, arrB);
    assert.strictEqual(diff.patches.length, 4);

    // Invariant: Removals MUST be emitted in strictly descending index order: 5, 4, 3, 2
    const expectedPaths = ['/5', '/4', '/3', '/2'];
    for (let i = 0; i < diff.patches.length; i++) {
      assert.strictEqual(diff.patches[i].op, 'remove');
      assert.strictEqual(diff.patches[i].path, expectedPaths[i]);
    }

    // Apply patch: must arrive at [10, 20]
    const patched = Diff.applyPatch(arrA, diff.patches);
    assert.deepStrictEqual(patched, [10, 20]);
  });

  test('4.3 Array insertions and item replacements', () => {
    const arrA = ['apple', 'banana'];
    const arrB = ['apple', 'blueberry', 'cherry', 'date'];

    const diff = Diff.compare(arrA, arrB);
    const patched = Diff.applyPatch(arrA, diff.patches);
    assert.deepStrictEqual(patched, arrB);

    // Test array reordering
    const orig = [1, 2, 3, 4];
    const reordered = [4, 3, 2, 1];
    const diffReorder = Diff.compare(orig, reordered);
    const patchedReorder = Diff.applyPatch(orig, diffReorder.patches);
    assert.deepStrictEqual(patchedReorder, reordered);
  });

  test('4.4 RFC 6901 JSON Pointer escaping (~0 for ~, ~1 for /)', () => {
    const treeA = {
      'path/with/slash': 1,
      'key~with~tilde': 2,
      'slash/and~tilde': 3
    };
    const treeB = {
      'path/with/slash': 100,
      'key~with~tilde': 200,
      'slash/and~tilde': 300,
      'new/key~combo': 400
    };

    const diff = Diff.compare(treeA, treeB);
    const pathSet = new Set(diff.patches.map(p => p.path));

    assert.ok(pathSet.has('/path~1with~1slash'), 'Slash must be escaped as ~1');
    assert.ok(pathSet.has('/key~0with~0tilde'), 'Tilde must be escaped as ~0');
    assert.ok(pathSet.has('/slash~1and~0tilde'), 'Both ~ and / escaped correctly');
    assert.ok(pathSet.has('/new~1key~0combo'), 'Added escaped key present');

    const patched = Diff.applyPatch(treeA, diff.patches);
    assert.ok(IR.deepEquals(patched, treeB));
  });

  test('4.5 Diff structural summary string accuracy', () => {
    // Case 1: Identical
    const res1 = Diff.compare({ x: 1 }, { x: 1 });
    assert.strictEqual(res1.summary, 'Identical (0 changes)');

    // Case 2: Multi-op summary
    const treeA = { a: 1, b: 2, c: 3 };
    const treeB = { a: 1, b: 20, d: 4 }; // 1 removal (c), 1 add (d), 1 mod (b)
    const res2 = Diff.compare(treeA, treeB);
    assert.ok(res2.summary.includes('+1 added'));
    assert.ok(res2.summary.includes('-1 removed'));
    assert.ok(res2.summary.includes('~1 modified'));
  });

  test('4.6 Round-trip patch invertibility across 30 randomized structures', () => {
    const makeRandomTree = depth => {
      if (depth <= 0) {
        const choices = ['str_' + Math.random().toString(36).substring(7), Math.floor(Math.random() * 100), Math.random() > 0.5, null];
        return choices[Math.floor(Math.random() * choices.length)];
      }
      if (Math.random() > 0.4) {
        // Object
        const obj = {};
        const keyCount = Math.floor(Math.random() * 4) + 1;
        for (let i = 0; i < keyCount; i++) {
          obj['k_' + i] = makeRandomTree(depth - 1);
        }
        return obj;
      } else {
        // Array
        const arr = [];
        const count = Math.floor(Math.random() * 4) + 1;
        for (let i = 0; i < count; i++) {
          arr.push(makeRandomTree(depth - 1));
        }
        return arr;
      }
    };

    for (let round = 1; round <= 30; round++) {
      const treeA = makeRandomTree(3);
      const treeB = makeRandomTree(3);

      const diff = Diff.compare(treeA, treeB);
      const reconstructed = Diff.applyPatch(treeA, diff.patches);

      assert.ok(
        IR.deepEquals(reconstructed, treeB),
        `Round ${round}: applyPatch(A, compare(A, B).patches) must equal B`
      );
    }
  });

  test('4.7 Document root replacement when root type changes', () => {
    // Object to primitive
    const d1 = Diff.compare({ a: 1 }, 42);
    assert.strictEqual(d1.patches[0].op, 'replace');
    assert.strictEqual(Diff.applyPatch({ a: 1 }, d1.patches), 42);

    // Primitive to Array
    const d2 = Diff.compare('hello', [1, 2, 3]);
    assert.deepStrictEqual(Diff.applyPatch('hello', d2.patches), [1, 2, 3]);

    // Array to Object
    const d3 = Diff.compare([1, 2], { x: 'test' });
    assert.deepStrictEqual(Diff.applyPatch([1, 2], d3.patches), { x: 'test' });
  });

  test('4.8 Array of heterogeneous objects with combined modifications, additions, and deletions', () => {
    const treeA = [
      { id: 1, name: 'Alice', score: 85 },
      { id: 2, name: 'Bob', score: 90 },
      { id: 3, name: 'Charlie', score: 75 }
    ];
    const treeB = [
      { id: 1, name: 'Alice', score: 95, honors: true }, // modified + added property
      { id: 2, name: 'Robert' } // modified name, removed score, Charlie removed
    ];

    const diff = Diff.compare(treeA, treeB);
    const patched = Diff.applyPatch(treeA, diff.patches);
    assert.ok(IR.deepEquals(patched, treeB), 'Heterogeneous array of objects must match exactly');
  });

  // ===========================================================================
  // SUITE 5: Canonical IR Edge Cases & Performance Stress
  // ===========================================================================
  console.log('\n▶ [Suite 5/5] Testing Canonical IR Edge Cases & High-Frequency Stress...');

  test('5.1 Canonical IR: deepEquals key-order independence and symmetry', () => {
    const a = {
      z: [1, { alpha: 'first', beta: 'second' }],
      y: { m: true, n: null },
      x: 42
    };
    const b = {
      x: 42,
      y: { n: null, m: true },
      z: [1, { beta: 'second', alpha: 'first' }]
    };

    assert.strictEqual(IR.deepEquals(a, b), true, 'deepEquals must be true regardless of key insertion order');
    assert.strictEqual(IR.deepEquals(b, a), true, 'deepEquals must be symmetric');

    // Slight mismatch
    const c = JSON.parse(JSON.stringify(b));
    c.z[1].alpha = 'mismatch';
    assert.strictEqual(IR.deepEquals(a, c), false);
  });

  test('5.2 Canonical IR: Extreme types normalization (Dates, BigInt, NaN, Infinity)', () => {
    const now = new Date();
    const raw = {
      date: now,
      safeBig: BigInt(9007199254740991),
      unsafeBig: BigInt('9007199254740992000'),
      nan: NaN,
      inf: Infinity,
      negInf: -Infinity,
      undef: undefined
    };

    const norm = IR.normalize(raw);
    assert.strictEqual(norm.date, now.toISOString());
    assert.strictEqual(norm.safeBig, 9007199254740991);
    assert.strictEqual(norm.unsafeBig, '9007199254740992000');
    assert.strictEqual(norm.nan, null);
    assert.strictEqual(norm.inf, null);
    assert.strictEqual(norm.negInf, null);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(norm, 'undef'), false, 'Undefined stripped');
  });

  test('5.3 Canonical IR: Circular reference detection without stack overflow', () => {
    const circularObj = { name: 'circular_parent' };
    circularObj.self = circularObj;
    circularObj.nested = { backToParent: circularObj };

    const norm = IR.normalize(circularObj);
    assert.strictEqual(norm.self, '[Circular]');
    assert.strictEqual(norm.nested.backToParent, '[Circular]');
  });

  test('5.4 Canonical IR: Structural metrics & statistics computation', () => {
    const tree = {
      title: 'Metrics Test',
      count: 3,
      enabled: true,
      notes: null,
      items: [
        { id: 1, label: 'one' },
        { id: 2, label: 'two' }
      ]
    };

    const stats = IR.getStats(tree);
    assert.strictEqual(stats.types.string, 3); // 'Metrics Test', 'one', 'two'
    assert.strictEqual(stats.types.number, 3); // count: 3, id: 1, id: 2
    assert.strictEqual(stats.types.boolean, 1);
    assert.strictEqual(stats.types.null, 1);
    assert.strictEqual(stats.types.array, 1);
    assert.strictEqual(stats.types.object, 3); // root, item[0], item[1]
    assert.strictEqual(stats.arrayItemCount, 2);
    assert.ok(stats.maxDepth >= 3);
    assert.ok(stats.byteSize > 0);
  });

  test('5.5 High-frequency stress test (500 rapid conversions)', () => {
    const engine = new SyncEngine({ parsers: parsers });
    const payload = JSON.stringify({
      id: 'stress_test',
      timestamp: Date.now(),
      metrics: { cpu: 45.2, memory: 1024, healthy: true }
    });

    const formatCycle = ['json', 'yaml', 'xml', 'toml'];
    const startTime = Date.now();

    for (let i = 0; i < 500; i++) {
      const from = formatCycle[i % formatCycle.length];
      const to = formatCycle[(i + 1) % formatCycle.length];

      // Convert from json to 'from', then 'from' to 'to'
      const step1 = engine.convertImmediate(payload, 'json', from);
      assert.ok(step1.success, `Step 1 iteration ${i} failed`);
      const step2 = engine.convertImmediate(step1.result, from, to);
      assert.ok(step2.success, `Step 2 iteration ${i} failed`);
    }

    const duration = Date.now() - startTime;
    console.log(`    (500 dual-conversions completed in ${duration}ms, avg ${(duration / 500).toFixed(2)}ms/op)`);
    assert.ok(duration < 2500, '500 dual conversions should complete well within 2500ms');
  });

  // ===========================================================================
  // Summary
  // ===========================================================================
  console.log('\n================================================================');
  console.log(`  Challenger Verification Complete: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    console.error('\nFailures summary:');
    failures.forEach((f, idx) => {
      console.error(`${idx + 1}. ${f.name}: ${f.error.message}`);
    });
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllChallengerSuites().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

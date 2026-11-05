#!/usr/bin/env node
/**
 * OmniSync Data Studio - Headless CLI Test Runner
 * Zero-dependency isomorphic test execution engine for Node.js environments.
 * Usage:
 *   node runner.js
 *   node runner.js --tier=1
 *   node runner.js --tier=2
 *   node runner.js --tier=3
 *   node runner.js --tier=4
 *   node runner.js --filter="Unicode"
 */
'use strict';

const path = require('path');
const nodeAssert = require('assert');
const { performance } = require('perf_hooks');

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

// 1. Load Parsers
const parsersDir = path.resolve(__dirname, '../js/parsers');
const jsonParser = require(path.join(parsersDir, 'json.js'));
const yamlParser = require(path.join(parsersDir, 'yaml.js'));
const csvParser = require(path.join(parsersDir, 'csv.js'));
const xmlParser = require(path.join(parsersDir, 'xml.js'));
const tomlParser = require(path.join(parsersDir, 'toml.js'));

// 2. Load Core Engine
const engineDir = path.resolve(__dirname, '../js/engine');
const IR = require(path.join(engineDir, 'ir.js'));
const Diff = require(path.join(engineDir, 'diff.js'));
const Validator = require(path.join(engineDir, 'validator.js'));
const SyncEngine = require(path.join(engineDir, 'sync.js'));

// 3. Assemble Engine Context
const engine = {
  parsers: {
    json: jsonParser,
    yaml: yamlParser,
    csv: csvParser,
    xml: xmlParser,
    toml: tomlParser
  },
  SyncEngine: SyncEngine,
  IR: IR,
  Diff: Diff,
  Validator: Validator
};

// 4. Load Universal Test Suites
const testSuites = require('./test_suites.js');

// 5. Build Isomorphic Assertion Object
const assert = {
  ok: function (value, message) {
    if (!value) {
      nodeAssert.fail(message || `Expected truthy value, but received: ${value}`);
    }
  },
  strictEqual: function (actual, expected, message) {
    nodeAssert.strictEqual(actual, expected, message);
  },
  notStrictEqual: function (actual, expected, message) {
    nodeAssert.notStrictEqual(actual, expected, message);
  },
  deepStrictEqual: function (actual, expected, message) {
    // If IR.deepEquals passes, treat as equivalent (handles key-order invariance)
    if (IR && typeof IR.deepEquals === 'function' && IR.deepEquals(actual, expected)) {
      return;
    }
    nodeAssert.deepStrictEqual(actual, expected, message);
  },
  match: function (string, regex, message) {
    nodeAssert.match(string, regex, message);
  },
  throws: function (fn, expectedErr, message) {
    nodeAssert.throws(fn, expectedErr, message);
  }
};

// Parse CLI flags
const args = process.argv.slice(2);
let tierFilter = null;
let nameFilter = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--tier=')) {
    tierFilter = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--filter=')) {
    nameFilter = arg.split('=')[1].toLowerCase();
  }
}

// Banner
console.log(`\n${colors.cyan}${colors.bright}======================================================================${colors.reset}`);
console.log(`${colors.cyan}${colors.bright}  OmniSync Data Studio — Universal 4-Tier E2E Test Suite Runner       ${colors.reset}`);
console.log(`${colors.cyan}${colors.bright}======================================================================${colors.reset}`);
console.log(`${colors.gray}Environment: Node.js ${process.version} | Platform: ${process.platform} | No npm dependencies${colors.reset}`);
if (tierFilter) console.log(`${colors.yellow}Filter: Tier ${tierFilter} only${colors.reset}`);
if (nameFilter) console.log(`${colors.yellow}Filter: Name contains "${nameFilter}"${colors.reset}`);
console.log('');

// Test Execution Loop
let totalCount = 0;
let passedCount = 0;
let failedCount = 0;
const tierStats = {
  1: { total: 0, passed: 0, failed: 0, durationMs: 0 },
  2: { total: 0, passed: 0, failed: 0, durationMs: 0 },
  3: { total: 0, passed: 0, failed: 0, durationMs: 0 },
  4: { total: 0, passed: 0, failed: 0, durationMs: 0 }
};

const failures = [];
const overallStart = performance.now();

for (let s = 0; s < testSuites.length; s++) {
  const suite = testSuites[s];
  if (tierFilter && suite.tier !== tierFilter) {
    continue;
  }

  // Filter matching tests in suite
  const matchingTests = suite.tests.filter(t => {
    if (!nameFilter) return true;
    return t.name.toLowerCase().includes(nameFilter);
  });

  if (matchingTests.length === 0) continue;

  console.log(`${colors.bright}${colors.blue}▶ [Tier ${suite.tier}] ${suite.name}${colors.reset}`);

  for (let t = 0; t < matchingTests.length; t++) {
    const testCase = matchingTests[t];
    totalCount++;
    const tStats = tierStats[suite.tier] || { total: 0, passed: 0, failed: 0, durationMs: 0 };
    tStats.total++;

    const startTest = performance.now();
    try {
      testCase.run(assert, engine);
      const dur = performance.now() - startTest;
      passedCount++;
      tStats.passed++;
      tStats.durationMs += dur;
      console.log(`  ${colors.green}✔${colors.reset} ${testCase.name} ${colors.gray}(${dur.toFixed(2)}ms)${colors.reset}`);
    } catch (err) {
      const dur = performance.now() - startTest;
      failedCount++;
      tStats.failed++;
      tStats.durationMs += dur;
      console.log(`  ${colors.red}✖${colors.reset} ${testCase.name} ${colors.gray}(${dur.toFixed(2)}ms)${colors.reset}`);
      console.log(`    ${colors.red}${err.message}${colors.reset}`);
      failures.push({
        suite: suite.name,
        tier: suite.tier,
        test: testCase.name,
        error: err
      });
    }
  }
  console.log('');
}

const overallDuration = performance.now() - overallStart;

// Summary Table
console.log(`${colors.cyan}${colors.bright}----------------------------------------------------------------------${colors.reset}`);
console.log(`${colors.bright}  Tier Breakdown & Verification Summary                               ${colors.reset}`);
console.log(`${colors.cyan}${colors.bright}----------------------------------------------------------------------${colors.reset}`);
console.log(`  ${'Tier'.padEnd(8)} | ${'Total'.padStart(6)} | ${'Passed'.padStart(6)} | ${'Failed'.padStart(6)} | ${'Duration'.padStart(10)}`);
console.log(`  ${''.padEnd(8, '-')} | ${''.padStart(6, '-')} | ${''.padStart(6, '-')} | ${''.padStart(6, '-')} | ${''.padStart(10, '-')}`);

for (let tier = 1; tier <= 4; tier++) {
  const st = tierStats[tier];
  if (st.total > 0 || !tierFilter || tierFilter === tier) {
    const tierColor = st.failed > 0 ? colors.red : colors.green;
    console.log(
      `  Tier ${tier}`.padEnd(10) +
      `| ${String(st.total).padStart(6)} ` +
      `| ${tierColor}${String(st.passed).padStart(6)}${colors.reset} ` +
      `| ${st.failed > 0 ? colors.red : colors.gray}${String(st.failed).padStart(6)}${colors.reset} ` +
      `| ${(st.durationMs.toFixed(1) + 'ms').padStart(10)}`
    );
  }
}
console.log(`${colors.cyan}${colors.bright}----------------------------------------------------------------------${colors.reset}`);

if (failedCount > 0) {
  console.log(`\n${colors.red}${colors.bright}FAILED ASSERTIONS (${failedCount}):${colors.reset}`);
  failures.forEach((f, idx) => {
    console.log(`\n  ${idx + 1}. [Tier ${f.tier}] ${f.suite} -> ${f.test}`);
    console.log(`     ${colors.red}${f.error.stack || f.error.message}${colors.reset}`);
  });
  console.log(`\n${colors.bgRed}${colors.white}${colors.bright}  TEST RUN FAILED: ${passedCount} passed, ${failedCount} failed (${totalCount} total in ${overallDuration.toFixed(1)}ms)  ${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${colors.bgGreen}${colors.white}${colors.bright}  ALL TESTS PASSED! (${passedCount}/${totalCount} in ${overallDuration.toFixed(1)}ms)  ${colors.reset}\n`);
  process.exit(0);
}

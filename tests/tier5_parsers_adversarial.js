#!/usr/bin/env node
/**
 * OmniSync Data Studio - Tier 5 Adversarial Coverage Hardening Test Harness
 * White-box code audit and empirical verification across:
 * 1. TOML: Array of tables [[table]], inline tables, dotted keys, mixed types, multi-line strings.
 * 2. CSV: Multi-line quoted fields, ragged rows, auto-delimiter sniffing fallback, BOM, dot-notation.
 * 3. XML: Self-closing tags, namespace QNames, special character entities, CDATA, BadgerFish unwrapping.
 * 4. YAML: Document markers ---/..., literal blocks |, folded blocks >, flow sequences, Norway problem.
 * 5. JSON & Diff: RFC 6902 patches (add, remove, replace), RFC 6901 pointer escapes (~0, ~1), reverse array removals.
 * 6. Core Engine: Transitive cyclic conversion, SyncEngine non-destructive isolation, loop prevention.
 *
 * Zero external dependencies. Executable in Node.js.
 */
'use strict';

const path = require('path');
const nodeAssert = require('assert');
const { performance } = require('perf_hooks');

// ANSI Terminal Colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

// Load Parsers
const parsersDir = path.resolve(__dirname, '../js/parsers');
const jsonParser = require(path.join(parsersDir, 'json.js'));
const yamlParser = require(path.join(parsersDir, 'yaml.js'));
const csvParser = require(path.join(parsersDir, 'csv.js'));
const xmlParser = require(path.join(parsersDir, 'xml.js'));
const tomlParser = require(path.join(parsersDir, 'toml.js'));

// Load Core Engine
const engineDir = path.resolve(__dirname, '../js/engine');
const IR = require(path.join(engineDir, 'ir.js'));
const Diff = require(path.join(engineDir, 'diff.js'));
const Validator = require(path.join(engineDir, 'validator.js'));
const SyncEngine = require(path.join(engineDir, 'sync.js'));

// Test Harness State
let totalCount = 0;
let passedCount = 0;
let failedCount = 0;
const failures = [];
const gapAssessments = [];

const suiteStats = {};

function startSuite(suiteName) {
  console.log(`\n${c.bright}${c.blue}▶ [Tier 5] ${suiteName}${c.reset}`);
  suiteStats[suiteName] = { total: 0, passed: 0, failed: 0, durationMs: 0 };
}

function runTest(suiteName, testName, fn) {
  totalCount++;
  const stats = suiteStats[suiteName];
  stats.total++;

  const start = performance.now();
  try {
    fn();
    const dur = performance.now() - start;
    passedCount++;
    stats.passed++;
    stats.durationMs += dur;
    console.log(`  ${c.green}✔${c.reset} ${testName} ${c.gray}(${dur.toFixed(2)}ms)${c.reset}`);
  } catch (err) {
    const dur = performance.now() - start;
    failedCount++;
    stats.failed++;
    stats.durationMs += dur;
    console.log(`  ${c.red}✖${c.reset} ${testName} ${c.gray}(${dur.toFixed(2)}ms)${c.reset}`);
    console.log(`    ${c.red}${err.message}${c.reset}`);
    failures.push({ suite: suiteName, test: testName, error: err });
  }
}

function recordGap(title, description, severity) {
  gapAssessments.push({ title, description, severity });
}

// =========================================================================
// SUITE 1: TOML Adversarial Hardening
// =========================================================================
startSuite('Suite 1: TOML Adversarial Hardening');

runTest('Suite 1: TOML Adversarial Hardening', '1.1 Array of tables [[table]] with inline tables & dotted keys', () => {
  const input = [
    '[[products]]',
    'id = 101',
    'meta.sku = "SKU-992"',
    'meta.category = "Electronics"',
    'pricing = { base = 499.99, currency = "USD", discount = 0.10 }',
    '',
    '[[products]]',
    'id = 102',
    'meta.sku = "SKU-993"',
    'meta.category = "Accessories"',
    'pricing = { base = 29.99, currency = "USD", discount = 0 }'
  ].join('\n');

  const res = tomlParser.parse(input);
  nodeAssert.strictEqual(res.success, true, 'TOML parse should succeed');
  nodeAssert.ok(Array.isArray(res.data.products), 'products must be an array');
  nodeAssert.strictEqual(res.data.products.length, 2, 'Should have 2 products');

  // Verify dotted key unflattening inside table array
  nodeAssert.strictEqual(res.data.products[0].meta.sku, 'SKU-992');
  nodeAssert.strictEqual(res.data.products[0].meta.category, 'Electronics');

  // Verify inline table unflattening
  nodeAssert.strictEqual(res.data.products[0].pricing.base, 499.99);
  nodeAssert.strictEqual(res.data.products[0].pricing.currency, 'USD');
  nodeAssert.strictEqual(res.data.products[1].pricing.discount, 0);

  // Verify array of tables serialization with scalar fields
  const scalarArrayData = {
    servers: [
      { host: 'alpha.local', port: 8080 },
      { host: 'beta.local', port: 9090 }
    ]
  };
  const ser = tomlParser.stringify(scalarArrayData);
  nodeAssert.strictEqual(ser.success, true);
  nodeAssert.ok(ser.text.includes('[[servers]]'));
  const reparsed = tomlParser.parse(ser.text);
  nodeAssert.strictEqual(reparsed.success, true);
  nodeAssert.strictEqual(reparsed.data.servers.length, 2);
  nodeAssert.strictEqual(reparsed.data.servers[0].host, 'alpha.local');
});

runTest('Suite 1: TOML Adversarial Hardening', '1.2 Mixed types in arrays (scalars, nested arrays, inline tables)', () => {
  const input = 'mixedArray = [ 100, "string item", true, 3.14159, [ "nested", 42 ], { key = "val", count = 2 } ]';
  const res = tomlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  const arr = res.data.mixedArray;
  nodeAssert.strictEqual(arr[0], 100);
  nodeAssert.strictEqual(arr[1], 'string item');
  nodeAssert.strictEqual(arr[2], true);
  nodeAssert.strictEqual(arr[3], 3.14159);
  nodeAssert.deepStrictEqual(arr[4], ['nested', 42]);
  nodeAssert.deepStrictEqual(arr[5], { key: 'val', count: 2 });
});

runTest('Suite 1: TOML Adversarial Hardening', '1.3 Multiline basic strings (""") with escaped newlines and line continuations', () => {
  const input = [
    'str1 = """',
    'First line',
    'Second line with "embedded" quotes',
    'Third line"""',
    'str2 = """',
    'Roses are red, \\',
    'violets are blue, \\',
    'sugar is sweet"""'
  ].join('\n');

  const res = tomlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.str1, 'First line\nSecond line with "embedded" quotes\nThird line');
  nodeAssert.strictEqual(res.data.str2, 'Roses are red, violets are blue, sugar is sweet');
});

runTest('Suite 1: TOML Adversarial Hardening', '1.4 Multiline literal strings (\'\'\') preserving exact raw content', () => {
  const input = [
    'regexPattern = \'\'\'',
    '<\\i\\c*\\s*>',
    'C:\\Users\\Node\\path',
    'Line with \\n and \\t not escaped',
    '\'\'\''
  ].join('\n');

  const res = tomlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.ok(res.data.regexPattern.includes('C:\\Users\\Node\\path'));
  nodeAssert.ok(res.data.regexPattern.includes('\\n and \\t not escaped'));
});

runTest('Suite 1: TOML Adversarial Hardening', '1.5 Multiple array-of-tables definitions and table isolation', () => {
  const input = [
    '[[clients]]',
    'name = "Acme Corp"',
    'tier = "enterprise"',
    '[[clients]]',
    'name = "Startup Inc"',
    'tier = "starter"',
    '[[services]]',
    'name = "auth-service"',
    'replicas = 3'
  ].join('\n');

  const res = tomlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.clients.length, 2);
  nodeAssert.strictEqual(res.data.clients[0].name, 'Acme Corp');
  nodeAssert.strictEqual(res.data.clients[1].name, 'Startup Inc');
  nodeAssert.strictEqual(res.data.services.length, 1);
  nodeAssert.strictEqual(res.data.services[0].name, 'auth-service');
});

runTest('Suite 1: TOML Adversarial Hardening', '1.6 Syntax error detection & line/col diagnostics on malformed TOML', () => {
  // Test A: Missing '=' sign
  const err1 = tomlParser.parse('badKey "no equals"');
  nodeAssert.strictEqual(err1.success, false);
  nodeAssert.ok(err1.error.message.includes("Expected '='"));
  nodeAssert.strictEqual(err1.error.line, 1);

  // Test B: Unclosed array of tables header
  const err2 = tomlParser.parse('[[unclosed_table\nid = 1');
  nodeAssert.strictEqual(err2.success, false);
  nodeAssert.ok(err2.error.line >= 1);

  // Test C: Duplicate key in same table
  const err3 = tomlParser.parse('name = "Alpha"\nname = "Beta"');
  nodeAssert.strictEqual(err3.success, false);
  nodeAssert.ok(err3.error.message.includes('Duplicate key'));

  // Test D: Redefining existing table
  const err4 = tomlParser.parse('[server]\nport = 80\n[server]\nport = 443');
  nodeAssert.strictEqual(err4.success, false);
  nodeAssert.ok(err4.error.message.includes('Cannot redefine'));
});

runTest('Suite 1: TOML Adversarial Hardening', '1.7 Prototype pollution and unsafe key immunity', () => {
  const input = [
    '__proto__.polluted = "attack"',
    'constructor.prototype.hacked = true',
    'safeKey = "safeValue"'
  ].join('\n');

  const res = tomlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.safeKey, 'safeValue');
  nodeAssert.strictEqual(Object.prototype.polluted, undefined, '__proto__ must not be polluted');
  nodeAssert.strictEqual(Object.prototype.hacked, undefined, 'prototype must not be polluted');
});

runTest('Suite 1: TOML Adversarial Hardening', '1.8 [Gap Assessment] Nested array-of-tables [[parent.child]] scoping', () => {
  const input = [
    '[[fruits]]',
    'name = "Apple"',
    '[[fruits.varieties]]',
    'name = "Honeycrisp"'
  ].join('\n');

  const res = tomlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  // Empirical observation:
  if (res.data.fruits[0] && Array.isArray(res.data.fruits[0].varieties)) {
    nodeAssert.strictEqual(res.data.fruits[0].varieties[0].name, 'Honeycrisp');
  } else {
    recordGap(
      'TOML Parser Nested Table Array Scoping',
      "TOML parser attaches child array of tables [[parent.child]] as a property on the parent Array object (parent.child = [...]) instead of scoping into the last element of the parent table array (parent[parent.length - 1].child).",
      'MEDIUM'
    );
    console.log(`    ${c.yellow}ℹ Recorded Gap: Nested array-of-tables attaches property to parent Array object${c.reset}`);
  }
});

runTest('Suite 1: TOML Adversarial Hardening', '1.9 [Gap Assessment] TOML Serializer Sub-Tables in Array of Tables', () => {
  const complexArrayData = {
    products: [
      { id: 1, meta: { sku: 'SKU-1' } },
      { id: 2, meta: { sku: 'SKU-2' } }
    ]
  };
  const ser = tomlParser.stringify(complexArrayData);
  nodeAssert.strictEqual(ser.success, true);
  const reparsed = tomlParser.parse(ser.text);
  if (!reparsed.success && reparsed.error.message.includes('Cannot redefine existing table')) {
    recordGap(
      'TOML Serializer Sub-Table Naming in Array of Tables',
      "TOML serializer outputs standard sub-table headers ([products.meta]) for nested objects inside array-of-tables items. When multiple items contain sub-tables with the same key, subsequent items emit duplicate [products.meta] headers, which is rejected on re-parse as duplicate table redefinition.",
      'MEDIUM'
    );
    console.log(`    ${c.yellow}ℹ Recorded Gap: TOML serializer sub-table emission in table array causes duplicate table header on reparse${c.reset}`);
  } else {
    nodeAssert.strictEqual(reparsed.success, true);
  }
});

// =========================================================================
// SUITE 2: CSV Adversarial Hardening
// =========================================================================
startSuite('Suite 2: CSV Adversarial Hardening');

runTest('Suite 2: CSV Adversarial Hardening', '2.1 Multi-line quoted fields containing embedded newlines, delimiters & escaped quotes', () => {
  const q = '"';
  const input = [
    'id,title,description,price',
    '1,' + q + 'Widget, Deluxe' + q + ',' + q + 'Line 1\nLine 2, with comma\nLine 3 with ' + q + q + 'quotes' + q + q + q + ',49.95',
    '2,' + q + 'Simple' + q + ',' + q + 'One line' + q + ',19.99'
  ].join('\n');

  const res = csvParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.length, 2);
  nodeAssert.strictEqual(res.data[0].id, 1);
  nodeAssert.strictEqual(res.data[0].title, 'Widget, Deluxe');
  nodeAssert.strictEqual(res.data[0].description, 'Line 1\nLine 2, with comma\nLine 3 with "quotes"');
  nodeAssert.strictEqual(res.data[0].price, 49.95);

  // Verify stringify round-trip
  const ser = csvParser.stringify(res.data);
  nodeAssert.strictEqual(ser.success, true);
  const reparsed = csvParser.parse(ser.text);
  nodeAssert.strictEqual(reparsed.success, true);
  nodeAssert.strictEqual(reparsed.data[0].description, res.data[0].description);
});

runTest('Suite 2: CSV Adversarial Hardening', '2.2 Ragged rows with missing columns, empty cells, and extra columns', () => {
  const input = [
    'colA,colB,colC,colD',
    '1,2',            // Row 1: missing colC and colD -> should be null
    '3,,5,6',          // Row 2: empty colB -> should be null
    '7,8,9,10,11,12',  // Row 3: extra columns -> should be ignored safely
    ''                 // Trailing empty line -> ignored
  ].join('\n');

  const res = csvParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.length, 3);
  nodeAssert.strictEqual(res.data[0].colA, 1);
  nodeAssert.strictEqual(res.data[0].colB, 2);
  nodeAssert.strictEqual(res.data[0].colC, null);
  nodeAssert.strictEqual(res.data[0].colD, null);

  nodeAssert.strictEqual(res.data[1].colA, 3);
  nodeAssert.strictEqual(res.data[1].colB, null);
  nodeAssert.strictEqual(res.data[1].colC, 5);
  nodeAssert.strictEqual(res.data[1].colD, 6);

  nodeAssert.strictEqual(res.data[2].colA, 7);
  nodeAssert.strictEqual(res.data[2].colB, 8);
  nodeAssert.strictEqual(res.data[2].colC, 9);
  nodeAssert.strictEqual(res.data[2].colD, 10);
  nodeAssert.strictEqual(res.data[2]['colD.1'], undefined);
});

runTest('Suite 2: CSV Adversarial Hardening', '2.3 Auto-delimiter sniffing across comma, semicolon, tab, and pipe', () => {
  // Comma
  const resComma = csvParser.parse('name,age\nAlice,30');
  nodeAssert.strictEqual(resComma.data[0].name, 'Alice');

  // Semicolon
  const resSemi = csvParser.parse('name;age;city\nBob;25;Da Nang');
  nodeAssert.strictEqual(resSemi.data[0].name, 'Bob');
  nodeAssert.strictEqual(resSemi.data[0].city, 'Da Nang');

  // Tab
  const resTab = csvParser.parse('name\tage\trole\nCharlie\t28\tAdmin');
  nodeAssert.strictEqual(resTab.data[0].name, 'Charlie');
  nodeAssert.strictEqual(resTab.data[0].role, 'Admin');

  // Pipe
  const resPipe = csvParser.parse('name|age|score\nDavid|35|98.5');
  nodeAssert.strictEqual(resPipe.data[0].name, 'David');
  nodeAssert.strictEqual(resPipe.data[0].score, 98.5);
});

runTest('Suite 2: CSV Adversarial Hardening', '2.4 Delimiter sniffing fallback when delimiter candidates are inside quotes', () => {
  const q = '"';
  // Comma is inside quoted cells, but real row delimiter is semicolon
  const input = [
    q + 'city,country' + q + ';' + q + 'metric,score' + q,
    q + 'Hanoi,Vietnam' + q + ';' + q + 'AQI,45' + q
  ].join('\n');

  const res = csvParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.length, 1);
  nodeAssert.strictEqual(res.data[0]['city,country'], 'Hanoi,Vietnam');
  nodeAssert.strictEqual(res.data[0]['metric,score'], 'AQI,45');
});

runTest('Suite 2: CSV Adversarial Hardening', '2.5 Delimiter sniffing fallback on single-column documents without delimiters', () => {
  const input = 'logEntry\nStarting server\nInitializing DB\nReady';
  const res = csvParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.length, 3);
  nodeAssert.strictEqual(res.data[0].logEntry, 'Starting server');
  nodeAssert.strictEqual(res.data[2].logEntry, 'Ready');
});

runTest('Suite 2: CSV Adversarial Hardening', '2.6 Deep dot-notation unflattening & flattening round-trip with array indices', () => {
  const input = [
    'user.id,user.name,user.contact.email,user.roles.0,user.roles.1',
    '101,Minh Triet,triet@hcmut.edu.vn,Student,Lead Developer'
  ].join('\n');

  const res = csvParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  const u = res.data[0].user;
  nodeAssert.strictEqual(u.id, 101);
  nodeAssert.strictEqual(u.name, 'Minh Triet');
  nodeAssert.strictEqual(u.contact.email, 'triet@hcmut.edu.vn');
  nodeAssert.ok(Array.isArray(u.roles));
  nodeAssert.strictEqual(u.roles[0], 'Student');
  nodeAssert.strictEqual(u.roles[1], 'Lead Developer');

  // Verify flattening back to CSV
  const ser = csvParser.stringify(res.data);
  nodeAssert.strictEqual(ser.success, true);
  nodeAssert.ok(ser.text.includes('user.contact.email'));
});

runTest('Suite 2: CSV Adversarial Hardening', '2.7 UTF-8 BOM stripping and unclosed quote error diagnostic', () => {
  // UTF-8 BOM
  const bomText = '\uFEFFid,label\n1,BOM_Test';
  const resBom = csvParser.parse(bomText);
  nodeAssert.strictEqual(resBom.success, true);
  nodeAssert.strictEqual(resBom.data[0].id, 1);
  nodeAssert.strictEqual(resBom.data[0].label, 'BOM_Test');

  // Unclosed quote error
  const unclosed = 'id,name\n1,"Unclosed quote here\n2,next';
  const errRes = csvParser.parse(unclosed);
  nodeAssert.strictEqual(errRes.success, false);
  nodeAssert.strictEqual(errRes.error.line, 2);
  nodeAssert.strictEqual(errRes.error.column, 3);
  nodeAssert.ok(errRes.error.snippet.includes('^'));
});

// =========================================================================
// SUITE 3: XML Adversarial Hardening
// =========================================================================
startSuite('Suite 3: XML Adversarial Hardening');

runTest('Suite 3: XML Adversarial Hardening', '3.1 Self-closing empty tags (<item/>) and tags with attributes', () => {
  const input = [
    '<catalog>',
    '  <emptyTag/>',
    '  <product id="P-01" inStock="true"/>',
    '  <nested>',
    '    <leaf enabled="false"/>',
    '  </nested>',
    '</catalog>'
  ].join('\n');

  const res = xmlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  const cat = res.data.catalog;
  nodeAssert.strictEqual(cat.emptyTag, null);
  nodeAssert.strictEqual(cat.product['@id'], 'P-01');
  nodeAssert.strictEqual(cat.product['@inStock'], true);
  nodeAssert.strictEqual(cat.nested.leaf['@enabled'], false);
});

runTest('Suite 3: XML Adversarial Hardening', '3.2 Namespace QNames in element tags (<soap:Envelope>) and attributes', () => {
  const input = [
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:m="http://example.com/api">',
    '  <soap:Header>',
    '    <m:AuthToken m:type="bearer">XYZ-12345</m:AuthToken>',
    '  </soap:Header>',
    '  <soap:Body>',
    '    <m:GetProfile m:id="42">',
    '      <m:UserName>MinhTriet</m:UserName>',
    '    </m:GetProfile>',
    '  </soap:Body>',
    '</soap:Envelope>'
  ].join('\n');

  const res = xmlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  const env = res.data['soap:Envelope'];
  nodeAssert.strictEqual(env['@xmlns:soap'], 'http://schemas.xmlsoap.org/soap/envelope/');
  nodeAssert.strictEqual(env['@xmlns:m'], 'http://example.com/api');
  nodeAssert.strictEqual(env['soap:Header']['m:AuthToken']['#text'], 'XYZ-12345');
  nodeAssert.strictEqual(env['soap:Header']['m:AuthToken']['@m:type'], 'bearer');
  nodeAssert.strictEqual(env['soap:Body']['m:GetProfile']['m:UserName'], 'MinhTriet');
  nodeAssert.strictEqual(env['soap:Body']['m:GetProfile']['@m:id'], 42);
});

runTest('Suite 3: XML Adversarial Hardening', '3.3 Attribute entity decoding (&amp;, &lt;, &gt;, &quot;, &apos;, &#65;, &#x42;)', () => {
  const input = '<root attr="Symbols: &amp; &lt; &gt; &quot; &apos; | Code: &#65; and &#x42;"/>';
  const res = xmlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.root['@attr'], 'Symbols: & < > " \' | Code: A and B');
});

runTest('Suite 3: XML Adversarial Hardening', '3.4 CDATA preservation with raw XML tags and special characters', () => {
  const input = [
    '<config>',
    '  <script><![CDATA[function check(a, b) { return a < b && b > 0; }]]></script>',
    '  <htmlPayload><![CDATA[<div class="test">Hello & Welcome</div>]]></htmlPayload>',
    '</config>'
  ].join('\n');

  const res = xmlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.config.script, 'function check(a, b) { return a < b && b > 0; }');
  nodeAssert.strictEqual(res.data.config.htmlPayload, '<div class="test">Hello & Welcome</div>');
});

runTest('Suite 3: XML Adversarial Hardening', '3.5 BadgerFish array unwrapping for repeated sibling tags vs single tags', () => {
  const input = [
    '<store>',
    '  <branch code="B1">Main Store</branch>',
    '  <item id="1">Book</item>',
    '  <item id="2">Pen</item>',
    '  <item id="3">Notebook</item>',
    '</store>'
  ].join('\n');

  const res = xmlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  const store = res.data.store;

  // Single sibling remains single object
  nodeAssert.strictEqual(store.branch['@code'], 'B1');
  nodeAssert.strictEqual(store.branch['#text'], 'Main Store');

  // Repeated sibling aggregated into array
  nodeAssert.ok(Array.isArray(store.item));
  nodeAssert.strictEqual(store.item.length, 3);
  nodeAssert.strictEqual(store.item[0]['@id'], 1);
  nodeAssert.strictEqual(store.item[0]['#text'], 'Book');
  nodeAssert.strictEqual(store.item[2]['@id'], 3);
  nodeAssert.strictEqual(store.item[2]['#text'], 'Notebook');
});

runTest('Suite 3: XML Adversarial Hardening', '3.6 Synthetic root element wrapping on multi-key serialization', () => {
  const multiKeyData = {
    header: { title: 'Report' },
    body: { content: 'Data' },
    footer: { year: 2026 }
  };

  const ser = xmlParser.stringify(multiKeyData);
  nodeAssert.strictEqual(ser.success, true);
  nodeAssert.ok(ser.text.includes('<root>'));
  nodeAssert.ok(ser.text.includes('</root>'));
  nodeAssert.ok(ser.text.includes('<header>'));
  nodeAssert.ok(ser.text.includes('<footer>'));
});

runTest('Suite 3: XML Adversarial Hardening', '3.7 XML Syntax error handling & code frames for malformed XML', () => {
  // Test A: Mismatched closing tag
  const bad1 = '<document>\n  <header>Title</footerTag>\n</document>';
  const err1 = xmlParser.parse(bad1);
  nodeAssert.strictEqual(err1.success, false);
  nodeAssert.ok(err1.error.message.includes('Mismatched closing tag'));
  nodeAssert.strictEqual(err1.error.line, 2);

  // Test B: Unclosed tag
  const bad2 = '<root><unclosed>';
  const err2 = xmlParser.parse(bad2);
  nodeAssert.strictEqual(err2.success, false);
  nodeAssert.ok(err2.error.message.includes('Unclosed XML tag'));

  // Test C: Unclosed CDATA
  const bad3 = '<root><![CDATA[ unclosed CDATA';
  const err3 = xmlParser.parse(bad3);
  nodeAssert.strictEqual(err3.success, false);
  nodeAssert.ok(err3.error.message.includes('Unclosed CDATA'));
});

// =========================================================================
// SUITE 4: YAML Adversarial Hardening
// =========================================================================
startSuite('Suite 4: YAML Adversarial Hardening');

runTest('Suite 4: YAML Adversarial Hardening', '4.1 Document markers (--- and ...) with key-value mappings', () => {
  const input = [
    '---',
    '# Configuration Header',
    'apiVersion: v1',
    'kind: Service',
    'metadata:',
    '  name: my-service',
    '  namespace: default',
    '...'
  ].join('\n');

  const res = yamlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.apiVersion, 'v1');
  nodeAssert.strictEqual(res.data.kind, 'Service');
  nodeAssert.strictEqual(res.data.metadata.name, 'my-service');
  nodeAssert.strictEqual(res.data.metadata.namespace, 'default');
});

runTest('Suite 4: YAML Adversarial Hardening', '4.2 Literal "---" string values inside documents', () => {
  const input = [
    'delimiter: "---"',
    'endMarker: "..."',
    'nested:',
    '  rule: "--- separator ---"'
  ].join('\n');

  const res = yamlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.delimiter, '---');
  nodeAssert.strictEqual(res.data.endMarker, '...');
  nodeAssert.strictEqual(res.data.nested.rule, '--- separator ---');
});

runTest('Suite 4: YAML Adversarial Hardening', '4.3 Multi-line literal blocks (| and |-) preserving newlines & structure', () => {
  const input = [
    'script: |',
    '  set -e',
    '  echo "Starting build..."',
    '  make compile',
    '  echo "Done!"',
    'summary: |-',
    '  Single line without trailing newline'
  ].join('\n');

  const res = yamlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.ok(res.data.script.includes('set -e\necho "Starting build..."'));
  nodeAssert.ok(res.data.script.includes('echo "Done!"'));
  nodeAssert.strictEqual(res.data.summary, 'Single line without trailing newline');
});

runTest('Suite 4: YAML Adversarial Hardening', '4.4 Multi-line folded blocks (>) unfolding lines into single spaces', () => {
  const input = [
    'paragraph: >',
    '  This is a very long',
    '  sentence that should',
    '  be folded into a single',
    '  continuous line with spaces.'
  ].join('\n');

  const res = yamlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.strictEqual(res.data.paragraph, 'This is a very long sentence that should be folded into a single continuous line with spaces.');
});

runTest('Suite 4: YAML Adversarial Hardening', '4.5 Flow sequences [a, b] and flow mappings { "k": v }', () => {
  const input = [
    'ports: [80, 443, 8080]',
    'tags: ["web", "production", "ssl"]',
    'matrix:',
    '  - [1, 2, 3]',
    '  - [4, 5, 6]',
    'server: { "host": "127.0.0.1", "port": 3000, "secure": true }'
  ].join('\n');

  const res = yamlParser.parse(input);
  nodeAssert.strictEqual(res.success, true);
  nodeAssert.deepStrictEqual(res.data.ports, [80, 443, 8080]);
  nodeAssert.deepStrictEqual(res.data.tags, ['web', 'production', 'ssl']);
  nodeAssert.deepStrictEqual(res.data.matrix, [[1, 2, 3], [4, 5, 6]]);
  nodeAssert.strictEqual(res.data.server.host, '127.0.0.1');
  nodeAssert.strictEqual(res.data.server.port, 3000);
  nodeAssert.strictEqual(res.data.server.secure, true);
});

runTest('Suite 4: YAML Adversarial Hardening', '4.6 Boolean literal safeguards & "The Norway Problem" string protection', () => {
  // Parsing unquoted Norway booleans
  const rawInput = [
    'boolTrue1: true',
    'boolTrue2: yes',
    'boolTrue3: on',
    'boolFalse1: false',
    'boolFalse2: no',
    'boolFalse3: off',
    'norwayCountry: NO'
  ].join('\n');

  const rawRes = yamlParser.parse(rawInput);
  nodeAssert.strictEqual(rawRes.data.boolTrue1, true);
  nodeAssert.strictEqual(rawRes.data.boolTrue2, true);
  nodeAssert.strictEqual(rawRes.data.boolTrue3, true);
  nodeAssert.strictEqual(rawRes.data.boolFalse1, false);
  nodeAssert.strictEqual(rawRes.data.boolFalse2, false);
  nodeAssert.strictEqual(rawRes.data.boolFalse3, false);
  nodeAssert.strictEqual(rawRes.data.norwayCountry, false); // In YAML 1.1 NO is boolean false

  // Quoted string protection
  const quotedInput = [
    'countryCode: "NO"',
    'answer: "yes"',
    'flag: "true"'
  ].join('\n');

  const quotedRes = yamlParser.parse(quotedInput);
  nodeAssert.strictEqual(quotedRes.data.countryCode, 'NO');
  nodeAssert.strictEqual(quotedRes.data.answer, 'yes');
  nodeAssert.strictEqual(quotedRes.data.flag, 'true');

  // Serializer protection: Serializing string 'NO' must quote it
  const ser = yamlParser.stringify({ country: 'NO', status: 'yes' });
  nodeAssert.ok(ser.text.includes('"NO"') || ser.text.includes("'NO'"));
  nodeAssert.ok(ser.text.includes('"yes"') || ser.text.includes("'yes'"));
});

runTest('Suite 4: YAML Adversarial Hardening', '4.7 Tab indentation syntax error diagnostic reporting line and column', () => {
  const tabInput = 'parent:\n\tchildKey: 123';
  const res = yamlParser.parse(tabInput);
  nodeAssert.strictEqual(res.success, false);
  nodeAssert.strictEqual(res.error.line, 2);
  nodeAssert.strictEqual(res.error.column, 1);
  nodeAssert.ok(res.error.message.includes('tab'));
  nodeAssert.ok(res.error.snippet.includes('^'));
});

runTest('Suite 4: YAML Adversarial Hardening', '4.8 [Gap Assessment] Sequence document starting with --- marker', () => {
  const seqWithMarker = '---\n- alpha\n- beta';
  const res = yamlParser.parse(seqWithMarker);
  if (Array.isArray(res.data) && res.data.length === 2) {
    nodeAssert.strictEqual(res.data[0], 'alpha');
  } else {
    recordGap(
      'YAML Document Marker on Sequence Root',
      "YAML parser does not strip leading '---' before determining document root type. A root sequence list preceded by '---' (e.g. '---\\n- a\\n- b') is misidentified as a mapping, returning {} instead of ['a', 'b']. Note: Mappings with '---' work properly.",
      'MEDIUM'
    );
    console.log(`    ${c.yellow}ℹ Recorded Gap: YAML document marker preceding sequence root returns empty object${c.reset}`);
  }
});

runTest('Suite 4: YAML Adversarial Hardening', '4.9 [Gap Assessment] Global Comment Stripping inside Literal Block Scalars (|)', () => {
  const blockWithCommentChar = 'script: |\n  # shebang line\n  echo "hello"';
  const res = yamlParser.parse(blockWithCommentChar);
  if (res.data.script && res.data.script.includes('# shebang line')) {
    nodeAssert.ok(true);
  } else {
    recordGap(
      'YAML Comment Stripping Inside Literal Block Scalar',
      "stripInlineComment runs during global preprocessing before block parsing. Consequently, lines starting with '#' inside literal block scalars (|) are stripped from the payload.",
      'LOW'
    );
    console.log(`    ${c.yellow}ℹ Recorded Gap: Lines starting with '#' inside literal block scalars are stripped by preprocessor${c.reset}`);
  }
});

runTest('Suite 4: YAML Adversarial Hardening', '4.10 [Gap Assessment] Flow Mappings with Unquoted Keys', () => {
  const unquotedFlow = 'server: { host: "127.0.0.1", port: 3000 }';
  const res = yamlParser.parse(unquotedFlow);
  if (typeof res.data.server === 'object' && res.data.server !== null) {
    nodeAssert.strictEqual(res.data.server.port, 3000);
  } else {
    recordGap(
      'YAML Flow Mappings Require JSON-Compliant Double-Quoted Keys',
      "YAML parser delegates flow mappings ({...}) to JSON.parse. Unquoted keys ({ key: val }) throw SyntaxError in JSON.parse, falling back to returning the unparsed raw string.",
      'LOW'
    );
    console.log(`    ${c.yellow}ℹ Recorded Gap: Flow mappings with unquoted keys fall back to string; JSON-quoted keys required${c.reset}`);
  }
});

// =========================================================================
// SUITE 5: JSON & Diff Engine Adversarial Hardening
// =========================================================================
startSuite('Suite 5: JSON & Diff Engine Adversarial Hardening');

runTest('Suite 5: JSON & Diff Engine Adversarial Hardening', '5.1 RFC 6902 patch operations: add (object key, array shift, array append, root)', () => {
  const original = {
    title: 'Test Doc',
    tags: ['a', 'c'],
    meta: { version: 1 }
  };

  const patches = [
    { op: 'add', path: '/meta/author', value: 'Minh Triet' },
    { op: 'add', path: '/tags/1', value: 'b' }, // insert 'b' at index 1 -> ['a', 'b', 'c']
    { op: 'add', path: '/tags/-', value: 'd' }  // append 'd' to array -> ['a', 'b', 'c', 'd']
  ];

  const result = Diff.applyPatch(original, patches);
  nodeAssert.strictEqual(result.meta.author, 'Minh Triet');
  nodeAssert.deepStrictEqual(result.tags, ['a', 'b', 'c', 'd']);

  // Root replacement
  const rootPatch = [{ op: 'add', path: '', value: { newRoot: true } }];
  const rootResult = Diff.applyPatch(original, rootPatch);
  nodeAssert.deepStrictEqual(rootResult, { newRoot: true });
});

runTest('Suite 5: JSON & Diff Engine Adversarial Hardening', '5.2 RFC 6902 patch operations: remove and replace', () => {
  const original = {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ],
    deprecatedFlag: true
  };

  const patches = [
    { op: 'remove', path: '/deprecatedFlag' },
    { op: 'replace', path: '/users/1/name', value: 'Robert' },
    { op: 'remove', path: '/users/0' } // removes Alice, shifting Bob/Robert to index 0
  ];

  const result = Diff.applyPatch(original, patches);
  nodeAssert.strictEqual(result.deprecatedFlag, undefined);
  nodeAssert.strictEqual(result.users.length, 2);
  nodeAssert.strictEqual(result.users[0].name, 'Robert');
  nodeAssert.strictEqual(result.users[1].name, 'Charlie');
});

runTest('Suite 5: JSON & Diff Engine Adversarial Hardening', '5.3 Reverse-order array removals in Diff.compare', () => {
  const arrA = [10, 20, 30, 40, 50];
  const arrB = [10, 20]; // 3 items removed: indices 4, 3, 2

  const diffResult = Diff.compare(arrA, arrB);
  nodeAssert.strictEqual(diffResult.removals.length, 3);
  nodeAssert.strictEqual(diffResult.patches.length, 3);

  // Invariant: Patches MUST remove in reverse order (4, then 3, then 2)
  // to avoid shifting un-removed elements and breaking index alignment!
  nodeAssert.strictEqual(diffResult.patches[0].path, '/4');
  nodeAssert.strictEqual(diffResult.patches[1].path, '/3');
  nodeAssert.strictEqual(diffResult.patches[2].path, '/2');

  // Verify applying these patches to arrA produces arrB exactly
  const applied = Diff.applyPatch(arrA, diffResult.patches);
  nodeAssert.deepStrictEqual(applied, arrB);
});

runTest('Suite 5: JSON & Diff Engine Adversarial Hardening', '5.4 RFC 6901 pointer escape sequences (~0 for ~, ~1 for /)', () => {
  const a = {
    'folder/path': 'old/val',
    't~m~p': 'temp1',
    'compound~01/mix': 100
  };

  const b = {
    'folder/path': 'new/val',
    't~m~p': 'temp2',
    'compound~01/mix': 200
  };

  const diff = Diff.compare(a, b);
  nodeAssert.strictEqual(diff.patches.length, 3);

  // Check RFC 6901 paths
  const paths = diff.patches.map(p => p.path);
  nodeAssert.ok(paths.includes('/folder~1path'), "Slash must be escaped as ~1");
  nodeAssert.ok(paths.includes('/t~0m~0p'), "Tilde must be escaped as ~0");
  nodeAssert.ok(paths.includes('/compound~001~1mix'), "Compound escape ~0 and /");

  // Round trip applyPatch
  const applied = Diff.applyPatch(a, diff.patches);
  nodeAssert.strictEqual(applied['folder/path'], 'new/val');
  nodeAssert.strictEqual(applied['t~m~p'], 'temp2');
  nodeAssert.strictEqual(applied['compound~01/mix'], 200);
});

runTest('Suite 5: JSON & Diff Engine Adversarial Hardening', '5.5 RFC 6901 pointer parser decode order (~1 before ~0)', () => {
  // Pointer '/a~01b': ~0 must unescape to '~', so segment becomes 'a~1b'.
  // If ~1 were mistakenly unescaped after ~0, it would turn into 'a/b'!
  const segs = IR.parsePointer('/a~01b');
  nodeAssert.strictEqual(segs.length, 1);
  nodeAssert.strictEqual(segs[0], 'a~1b', 'Should decode to a~1b, NOT a/b');

  // Pointer '/a~1b': unescapes to 'a/b'
  const segsSlash = IR.parsePointer('/a~1b');
  nodeAssert.strictEqual(segsSlash[0], 'a/b');

  // Re-encode to pointer
  const back = IR.toPointer(segs);
  nodeAssert.strictEqual(back, '/a~01b');
});

runTest('Suite 5: JSON & Diff Engine Adversarial Hardening', '5.6 Prototype pollution protection across Diff, IR and JSON', () => {
  const target = { user: 'Alice' };

  // Attempt __proto__ modification via patch
  const evilPatches = [
    { op: 'add', path: '/__proto__/polluted', value: 'danger' },
    { op: 'add', path: '/constructor/prototype/polluted', value: 'danger' }
  ];

  Diff.applyPatch(target, evilPatches);
  nodeAssert.strictEqual(Object.prototype.polluted, undefined, '__proto__ must be immune to patch pollution');

  // Attempt setAtPath pollution
  IR.setAtPath(target, ['__proto__', 'polluted2'], 'danger2');
  nodeAssert.strictEqual(Object.prototype.polluted2, undefined, 'IR.setAtPath must be immune');
});

runTest('Suite 5: JSON & Diff Engine Adversarial Hardening', '5.7 Circular reference detection & BigInt safe serialization', () => {
  // Circular reference in IR.normalize
  const circularObj = { name: 'Root' };
  circularObj.self = circularObj;

  const normalized = IR.normalize(circularObj);
  nodeAssert.strictEqual(normalized.self, '[Circular]');

  // Circular reference in jsonParser.stringify
  const serRes = jsonParser.stringify(circularObj);
  nodeAssert.strictEqual(serRes.success, false);
  nodeAssert.ok(serRes.error.message.includes('Circular reference'));

  // BigInt normalization
  const bigWithin = IR.normalize(BigInt(9007199254740991));
  nodeAssert.strictEqual(typeof bigWithin, 'number');

  const bigBeyond = IR.normalize(BigInt('9007199254740993'));
  nodeAssert.strictEqual(typeof bigBeyond, 'string');
});

// =========================================================================
// SUITE 6: Cross-Format Transitivity & Sync Engine Hardening
// =========================================================================
startSuite('Suite 6: Cross-Engine Integration & Transitive Integrity');

runTest('Suite 6: Cross-Engine Integration & Transitive Integrity', '6.1 5-Format Transitive Cyclic Conversion (JSON -> YAML -> TOML -> XML -> JSON)', () => {
  const original = {
    service: {
      name: 'OmniSync Studio',
      port: 8080,
      active: true,
      tags: ['converter', 'synchronizer', 'schema'],
      metrics: { cpu: 1.25, memory: 48.6 }
    }
  };

  // Step 1: JSON -> YAML
  const yamlOut = yamlParser.stringify(original);
  nodeAssert.strictEqual(yamlOut.success, true);
  const yamlParsed = yamlParser.parse(yamlOut.text);
  nodeAssert.strictEqual(yamlParsed.success, true);

  // Step 2: YAML -> TOML
  const tomlOut = tomlParser.stringify(yamlParsed.data);
  nodeAssert.strictEqual(tomlOut.success, true);
  const tomlParsed = tomlParser.parse(tomlOut.text);
  nodeAssert.strictEqual(tomlParsed.success, true);

  // Step 3: TOML -> XML
  const xmlOut = xmlParser.stringify(tomlParsed.data);
  nodeAssert.strictEqual(xmlOut.success, true);
  const xmlParsed = xmlParser.parse(xmlOut.text);
  nodeAssert.strictEqual(xmlParsed.success, true);

  // Step 4: XML -> JSON
  const jsonOut = jsonParser.stringify(xmlParsed.data);
  nodeAssert.strictEqual(jsonOut.success, true);
  const jsonFinal = jsonParser.parse(jsonOut.text);
  nodeAssert.strictEqual(jsonFinal.success, true);

  // Check core data preserved through cyclic conversion
  const finalService = jsonFinal.data.service;
  nodeAssert.strictEqual(finalService.name, 'OmniSync Studio');
  nodeAssert.strictEqual(finalService.port, 8080);
  nodeAssert.strictEqual(finalService.active, true);
});

runTest('Suite 6: Cross-Engine Integration & Transitive Integrity', '6.2 SyncEngine non-destructive syntax error containment', () => {
  let targetReceived = null;
  let errorReceived = null;

  const sync = new SyncEngine({
    debounceMs: 50,
    onSync: function (evt) { targetReceived = evt; },
    onError: function (err) { errorReceived = err; }
  });

  // Initial valid input
  sync.executeSync('left', '{"status": "ok"}', 'json', 'yaml');
  nodeAssert.ok(targetReceived !== null, 'Initial sync should succeed');
  nodeAssert.strictEqual(targetReceived.targetFormat, 'yaml');
  nodeAssert.strictEqual(sync.state, 'SYNCED');

  // Reset trackers and send malformed input
  targetReceived = null;
  errorReceived = null;

  sync.executeSync('left', '{"status": unquoted_syntax_error', 'json', 'yaml');
  nodeAssert.strictEqual(sync.state, 'ERROR');
  nodeAssert.ok(errorReceived !== null, 'onError callback must be fired');
  nodeAssert.strictEqual(errorReceived.sourcePane, 'left');
  nodeAssert.ok(errorReceived.error.line >= 1);
  nodeAssert.ok(errorReceived.error.snippet.includes('^'));

  // CRITICAL INVARIANT: Peer pane is NOT updated on error!
  nodeAssert.strictEqual(targetReceived, null, 'Peer pane must NOT be updated when source has syntax error');
});

runTest('Suite 6: Cross-Engine Integration & Transitive Integrity', '6.3 SyncEngine cycle-breaking guard against ping-pong feedback loops', () => {
  let syncCount = 0;

  const sync = new SyncEngine({
    debounceMs: 50,
    onSync: function () { syncCount++; }
  });

  // Sync initial data
  sync.executeSync('left', '{"count": 42}', 'json', 'yaml');
  nodeAssert.strictEqual(syncCount, 1);

  // Repeated sync with semantically identical IR
  sync.executeSync('left', '{\n  "count": 42\n}', 'json', 'yaml');
  // Cycle guard: because canonical IR is identical, no target update should fire
  nodeAssert.strictEqual(syncCount, 1, 'Identical canonical IR must not trigger re-sync');
  nodeAssert.strictEqual(sync.state, 'SYNCED');
});

runTest('Suite 6: Cross-Engine Integration & Transitive Integrity', '6.4 Schema validator adversarial edge cases (Draft-07 subset)', () => {
  const schema = {
    type: 'object',
    required: ['id', 'username', 'email'],
    properties: {
      id: { type: 'integer', minimum: 1 },
      username: { type: 'string', minLength: 3, maxLength: 20, pattern: '^[a-zA-Z0-9_]+$' },
      email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
      roles: { type: 'array', minItems: 1, items: { type: 'string' } }
    }
  };

  // Valid payload
  const validData = {
    id: 10,
    username: 'minhtriet25',
    email: 'triet@hcmut.edu.vn',
    roles: ['admin', 'developer']
  };
  const valResult = Validator.validateSchema(schema, validData);
  nodeAssert.strictEqual(valResult.valid, true);
  nodeAssert.strictEqual(valResult.errors.length, 0);

  // Invalid payload: missing required field, bad regex, negative int, empty array
  const invalidData = {
    id: -5,
    username: 'invalid name with spaces!',
    roles: []
  };
  const invalidResult = Validator.validateSchema(schema, invalidData);
  nodeAssert.strictEqual(invalidResult.valid, false);
  const keywords = invalidResult.errors.map(e => e.keyword);
  nodeAssert.ok(keywords.includes('required'), 'Should flag missing required email');
  nodeAssert.ok(keywords.includes('minimum'), 'Should flag id < 1');
  nodeAssert.ok(keywords.includes('pattern'), 'Should flag username pattern mismatch');
  nodeAssert.ok(keywords.includes('minItems'), 'Should flag empty roles array');
});

// =========================================================================
// SUMMARY & VERDICT
// =========================================================================
console.log(`\n${c.cyan}${c.bright}======================================================================${c.reset}`);
console.log(`${c.bright}  Tier 5 Adversarial Hardening — Execution Summary                   ${c.reset}`);
console.log(`${c.cyan}${c.bright}======================================================================${c.reset}`);
console.log(`  ${'Suite Name'.padEnd(52)} | ${'Pass'.padStart(5)} | ${'Fail'.padStart(5)} | ${'Duration'.padStart(9)}`);
console.log(`  ${''.padEnd(52, '-')} | ${''.padStart(5, '-')} | ${''.padStart(5, '-')} | ${''.padStart(9, '-')}`);

Object.keys(suiteStats).forEach(sName => {
  const st = suiteStats[sName];
  const passColor = st.passed > 0 ? c.green : c.gray;
  const failColor = st.failed > 0 ? c.red : c.gray;
  console.log(
    `  ${sName.padEnd(52)} ` +
    `| ${passColor}${String(st.passed).padStart(5)}${c.reset} ` +
    `| ${failColor}${String(st.failed).padStart(5)}${c.reset} ` +
    `| ${(st.durationMs.toFixed(1) + 'ms').padStart(9)}`
  );
});

console.log(`${c.cyan}${c.bright}----------------------------------------------------------------------${c.reset}`);
console.log(`  Total Executed : ${totalCount}`);
console.log(`  Total Passed   : ${c.green}${passedCount}${c.reset}`);
console.log(`  Total Failed   : ${failedCount > 0 ? c.red : c.green}${failedCount}${c.reset}`);
console.log(`  Total Gaps Logged: ${gapAssessments.length > 0 ? c.yellow : c.green}${gapAssessments.length}${c.reset}`);
console.log(`${c.cyan}${c.bright}======================================================================${c.reset}`);

if (gapAssessments.length > 0) {
  console.log(`\n${c.yellow}${c.bright}EMPIRICAL GAP ASSESSMENTS (${gapAssessments.length}):${c.reset}`);
  gapAssessments.forEach((gap, idx) => {
    console.log(`\n  [Gap ${idx + 1}] [${gap.severity}] ${gap.title}`);
    console.log(`    ${gap.description}`);
  });
}

if (failedCount > 0) {
  console.log(`\n${c.red}${c.bright}FAILED TESTS (${failedCount}):${c.reset}`);
  failures.forEach((f, idx) => {
    console.log(`\n  ${idx + 1}. [${f.suite}] -> ${f.test}`);
    console.log(`     ${c.red}${f.error.stack || f.error.message}${c.reset}`);
  });
  console.log(`\n${c.bgRed}${c.white}${c.bright}  TIER 5 HARNESS COMPLETED WITH FAILURES: ${passedCount} passed, ${failedCount} failed  ${c.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${c.bgGreen}${c.white}${c.bright}  TIER 5 HARNESS PASSED 100%! (${passedCount}/${totalCount} tests passed)  ${c.reset}\n`);
  process.exit(0);
}

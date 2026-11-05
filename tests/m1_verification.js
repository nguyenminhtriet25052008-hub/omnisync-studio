/**
 * OmniSync Data Studio - Milestone 1 Comprehensive Verification Test Suite
 * Tests all 5 parsers/serializers and 4 core engine modules.
 * Runs in pure Node.js with ZERO external dependencies.
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

// Test Runner Framework
let passedCount = 0;
let failedCount = 0;
const testResults = [];

function test(name, fn) {
  try {
    fn();
    passedCount++;
    testResults.push({ name, pass: true });
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failedCount++;
    testResults.push({ name, pass: false, error: err });
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passedCount++;
    testResults.push({ name, pass: true });
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (err) {
    failedCount++;
    testResults.push({ name, pass: false, error: err });
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log('  OmniSync Data Studio — Milestone 1 Verification Test Suite');
  console.log('===============================================================\n');

  // =========================================================================
  // SECTION 1: JSON Parser & Serializer
  // =========================================================================
  console.log('▶ [1/9] Testing JSON Parser & Serializer...');

  test('JSON: Standard parse and stringify round-trip', () => {
    const raw = '{\n  "title": "OmniSync",\n  "active": true,\n  "count": 42,\n  "tags": ["sync", "core"]\n}';
    const parsed = jsonParser.parse(raw);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.data.title, 'OmniSync');
    assert.strictEqual(parsed.data.count, 42);
    assert.deepStrictEqual(parsed.data.tags, ['sync', 'core']);

    const stringified = jsonParser.stringify(parsed.data);
    assert.strictEqual(stringified.success, true);
    assert.ok(stringified.text.includes('"title": "OmniSync"'));
  });

  test('JSON: Formatting indentation options (compact, tab, custom number)', () => {
    const data = { a: 1, b: [2] };
    const compact = jsonParser.stringify(data, { indent: 'compact' });
    assert.strictEqual(compact.text, '{"a":1,"b":[2]}');

    const tabbed = jsonParser.stringify(data, { indent: 'tab' });
    assert.ok(tabbed.text.includes('\t"a": 1'));

    const spaced4 = jsonParser.stringify(data, { indent: 4 });
    assert.ok(spaced4.text.includes('    "a": 1'));
  });

  test('JSON: Precise line/column and visual caret error locator', () => {
    const broken = '{\n  "name": "OmniSync",\n  "missing": \n}';
    const res = jsonParser.parse(broken);
    assert.strictEqual(res.success, false);
    assert.ok(res.error, 'Error object must be present');
    assert.strictEqual(typeof res.error.line, 'number');
    assert.strictEqual(typeof res.error.column, 'number');
    assert.ok(res.error.line >= 3, `Expected line >= 3, got ${res.error.line}`);
    assert.ok(res.error.snippet.includes('^'), 'Visual caret ^ must be in snippet');
  });

  test('JSON: Circular reference protection', () => {
    const cyclic = { name: 'Cyclic' };
    cyclic.self = cyclic;
    const res = jsonParser.stringify(cyclic);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.message.includes('Circular reference'));
  });

  test('JSON: BigInt handling', () => {
    const data = { big: BigInt(9007199254740991) };
    const res = jsonParser.stringify(data);
    assert.strictEqual(res.success, true);
    assert.ok(res.text.includes('9007199254740991'));
  });

  // =========================================================================
  // SECTION 2: YAML Parser & Serializer
  // =========================================================================
  console.log('\n▶ [2/9] Testing YAML Parser & Serializer...');

  test('YAML: Mapping and sequence parse', () => {
    const yaml = 'app: OmniSync\nversion: 1.0\nenabled: true\nfeatures:\n  - conversion\n  - diff\n  - sync';
    const res = yamlParser.parse(yaml);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.app, 'OmniSync');
    assert.strictEqual(res.data.version, 1.0);
    assert.strictEqual(res.data.enabled, true);
    assert.deepStrictEqual(res.data.features, ['conversion', 'diff', 'sync']);
  });

  test('YAML: Strict tab indentation rejection with line/col diagnostics', () => {
    const tabbed = 'server:\n\thost: localhost';
    const res = yamlParser.parse(tabbed);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.line, 2);
    assert.strictEqual(res.error.column, 1);
    assert.ok(res.error.message.includes('tabs'));
    assert.ok(res.error.snippet.includes('^'));
  });

  test('YAML: Quote safety ("The Norway Problem")', () => {
    const obj = { country: 'NO', active: 'true', flag: 'on', numberStr: '0123' };
    const emitted = yamlParser.stringify(obj);
    assert.strictEqual(emitted.success, true);
    assert.ok(emitted.text.includes('"NO"'), 'String "NO" must be double-quoted');
    assert.ok(emitted.text.includes('"true"'), 'String "true" must be double-quoted');
    assert.ok(emitted.text.includes('"on"'), 'String "on" must be double-quoted');
    assert.ok(emitted.text.includes('"0123"'), 'Numeric string "0123" must be double-quoted');

    // Round-trip verification:
    const parsedBack = yamlParser.parse(emitted.text);
    assert.strictEqual(parsedBack.success, true);
    assert.strictEqual(parsedBack.data.country, 'NO');
    assert.strictEqual(parsedBack.data.active, 'true');
    assert.strictEqual(parsedBack.data.flag, 'on');
    assert.strictEqual(parsedBack.data.numberStr, '0123');
  });

  test('YAML: Multiline literal string (|) block', () => {
    const yaml = 'description: |\n  Line one\n  Line two\n  Line three';
    const res = yamlParser.parse(yaml);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.description, 'Line one\nLine two\nLine three');
  });

  test('YAML: Comments stripping', () => {
    const yaml = '# Header comment\nname: Project # inline comment\ncount: 5';
    const res = yamlParser.parse(yaml);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.name, 'Project');
    assert.strictEqual(res.data.count, 5);
  });

  test('YAML: Quoted keys containing colons (double and single quotes)', () => {
    const yamlInput = [
      '"http://api.example.com:8080/v1": "service_endpoint"',
      '\'urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6\': true',
      '"key:with:multiple:colons": 42',
      '"nested:quoted \\"quoted\\" : key": "escaped_success"',
      '"service:config":',
      '  "db:host:port": "localhost:5432"',
      'endpoints:',
      '  - "https://auth.internal:443": active',
      '  - "https://data.internal:8443": standby'
    ].join('\n');

    const res = yamlParser.parse(yamlInput);
    assert.strictEqual(res.success, true, `YAML parsing failed: ${res.error && res.error.message}`);
    assert.strictEqual(res.data['http://api.example.com:8080/v1'], 'service_endpoint');
    assert.strictEqual(res.data['urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6'], true);
    assert.strictEqual(res.data['key:with:multiple:colons'], 42);
    assert.strictEqual(res.data['nested:quoted "quoted" : key'], 'escaped_success');
    assert.strictEqual(res.data['service:config']['db:host:port'], 'localhost:5432');
    assert.strictEqual(res.data.endpoints[0]['https://auth.internal:443'], 'active');
    assert.strictEqual(res.data.endpoints[1]['https://data.internal:8443'], 'standby');

    // Round-trip verification:
    const stringified = yamlParser.stringify(res.data);
    assert.strictEqual(stringified.success, true);
    const parsedBack = yamlParser.parse(stringified.text);
    assert.strictEqual(parsedBack.success, true);
    assert.deepStrictEqual(parsedBack.data, res.data);
  });

  test('YAML: Distinction between quoted keys with colons and plain URL scalars', () => {
    const yamlList = [
      'urls:',
      '  - http://example.com/test',
      '  - https://api.github.com/v3',
      '  - 12:30:00'
    ].join('\n');

    const res = yamlParser.parse(yamlList);
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data.urls));
    assert.strictEqual(res.data.urls[0], 'http://example.com/test');
    assert.strictEqual(res.data.urls[1], 'https://api.github.com/v3');
    assert.strictEqual(res.data.urls[2], '12:30:00');
  });

  // =========================================================================
  // SECTION 3: CSV Parser & Serializer
  // =========================================================================
  console.log('\n▶ [3/9] Testing CSV Parser & Serializer...');

  test('CSV: Auto-delimiter detection (semicolon, tab, pipe)', () => {
    const semicolonCsv = 'id;name;role\n1;Alice;Admin\n2;Bob;User';
    const parsedSemi = csvParser.parse(semicolonCsv);
    assert.strictEqual(parsedSemi.success, true);
    assert.strictEqual(parsedSemi.data.length, 2);
    assert.strictEqual(parsedSemi.data[0].name, 'Alice');

    const pipeCsv = 'id|name|role\n10|Charlie|Editor';
    const parsedPipe = csvParser.parse(pipeCsv);
    assert.strictEqual(parsedPipe.success, true);
    assert.strictEqual(parsedPipe.data[0].name, 'Charlie');
  });

  test('CSV: RFC 4180 quotes, escaped quotes ("") and multiline cell', () => {
    const complexCsv = '"id","text","notes"\n1,"Quote: ""Hello""","Line 1\nLine 2"';
    const parsed = csvParser.parse(complexCsv);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.data[0].text, 'Quote: "Hello"');
    assert.strictEqual(parsed.data[0].notes, 'Line 1\nLine 2');
  });

  test('CSV: Unclosed quote detection with line and column', () => {
    const badCsv = 'id,name\n1,"Unclosed quote field\n2,Bob';
    const res = csvParser.parse(badCsv);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.line, 2);
    assert.ok(res.error.message.includes('Unclosed quote'));
    assert.ok(res.error.snippet.includes('^'));
  });

  test('CSV: Dot-notation unflattening (hierarchical reconstruction)', () => {
    const flatCsv = 'id,user.name,user.address.city,roles.0,roles.1\n1,Alice,Hanoi,admin,editor';
    const res = csvParser.parse(flatCsv);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data[0].id, 1);
    assert.strictEqual(res.data[0].user.name, 'Alice');
    assert.strictEqual(res.data[0].user.address.city, 'Hanoi');
    assert.deepStrictEqual(res.data[0].roles, ['admin', 'editor']);
  });

  test('CSV: Hierarchical object flattening & heterogeneous superset headers', () => {
    const input = [
      { id: 1, user: { name: 'Alice', city: 'HCMC' }, tags: ['lead'] },
      { id: 2, user: { name: 'Bob' }, extra: 'active' }
    ];
    const stringified = csvParser.stringify(input);
    assert.strictEqual(stringified.success, true);
    const lines = stringified.text.split('\r\n');
    const header = lines[0];
    assert.ok(header.includes('user.name'));
    assert.ok(header.includes('user.city'));
    assert.ok(header.includes('tags.0'));
    assert.ok(header.includes('extra'));

    // Round-trip check
    const parsedBack = csvParser.parse(stringified.text);
    assert.strictEqual(parsedBack.data[0].user.city, 'HCMC');
    assert.strictEqual(parsedBack.data[1].user.name, 'Bob');
  });

  test('CSV: UTF-8 BOM stripping', () => {
    const bomCsv = '\uFEFFid,name\n1,Test';
    const res = csvParser.parse(bomCsv);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data[0].id, 1);
    assert.strictEqual(res.data[0].name, 'Test');
  });

  // =========================================================================
  // SECTION 4: XML Parser & Serializer
  // =========================================================================
  console.log('\n▶ [4/9] Testing XML Parser & Serializer...');

  test('XML: BadgerFish IR mapping (attributes @, text #text, siblings array)', () => {
    const xml = '<catalog name="Main">\n  <book id="101" inStock="true">\n    <title>Clean Code</title>\n    <price currency="USD">29.99</price>\n  </book>\n  <book id="102">\n    <title>Design Patterns</title>\n  </book>\n</catalog>';
    const res = xmlParser.parse(xml);
    assert.strictEqual(res.success, true);
    const catalog = res.data.catalog;
    assert.strictEqual(catalog['@name'], 'Main');
    assert.ok(Array.isArray(catalog.book), 'Repeated <book> elements must be an array');
    assert.strictEqual(catalog.book[0]['@id'], 101);
    assert.strictEqual(catalog.book[0]['@inStock'], true);
    assert.strictEqual(catalog.book[0].title, 'Clean Code');
    assert.strictEqual(catalog.book[0].price['@currency'], 'USD');
    assert.strictEqual(catalog.book[0].price['#text'], 29.99);
  });

  test('XML: CDATA section preservation & entity decoding', () => {
    const xml = '<note>\n  <desc><![CDATA[<b>Bold & Raw</b>]]></desc>\n  <author>Tom &amp; Jerry &quot;Show&quot;</author>\n</note>';
    const res = xmlParser.parse(xml);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.note.desc, '<b>Bold & Raw</b>');
    assert.strictEqual(res.data.note.author, 'Tom & Jerry "Show"');
  });

  test('XML: Synthetic root wrapping on serialization for multi-key objects & arrays', () => {
    const multiKey = { user: 'Minh Triet', role: 'Engineer' };
    const resMulti = xmlParser.stringify(multiKey);
    assert.strictEqual(resMulti.success, true);
    assert.ok(resMulti.text.includes('<root>'), 'Must wrap multi-key object in <root>');
    assert.ok(resMulti.text.includes('<user>Minh Triet</user>'));

    const arrayInput = [{ id: 1 }, { id: 2 }];
    const resArr = xmlParser.stringify(arrayInput);
    assert.strictEqual(resArr.success, true);
    assert.ok(resArr.text.includes('<root>'), 'Must wrap array in <root>');
  });

  test('XML: Mismatched and unclosed tag error reporting', () => {
    const mismatched = '<root>\n  <item>Data</wrong>\n</root>';
    const res = xmlParser.parse(mismatched);
    assert.strictEqual(res.success, false);
    assert.ok(res.error.message.includes('Mismatched closing tag'));
    assert.strictEqual(res.error.line, 2);
    assert.ok(res.error.snippet.includes('^'));
  });

  test('XML: Single-key array objects serialize to valid single-root XML and round-trip', () => {
    // 1. Array of objects
    const singleKeyObjArray = { items: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }] };
    const resXml = xmlParser.stringify(singleKeyObjArray);
    assert.strictEqual(resXml.success, true, `Stringify failed: ${resXml.error && resXml.error.message}`);
    assert.ok(resXml.text.includes('<root>'), 'Must wrap single-key array object in <root>');
    assert.ok(resXml.text.includes('</root>'), 'Must terminate with </root>');

    const parsedBack = xmlParser.parse(resXml.text);
    assert.strictEqual(parsedBack.success, true, `Parse back failed: ${parsedBack.error && parsedBack.error.message}`);
    assert.ok(parsedBack.data.root, 'Root element must exist in BadgerFish structure');
    assert.ok(Array.isArray(parsedBack.data.root.items), 'Repeated items must parse as array');
    assert.strictEqual(parsedBack.data.root.items.length, 2);
    assert.strictEqual(parsedBack.data.root.items[0].name, 'First');

    // 2. Array of primitives
    const primitiveArr = { tags: ['alpha', 'beta', 'gamma'] };
    const resPrim = xmlParser.stringify(primitiveArr);
    assert.strictEqual(resPrim.success, true);
    assert.ok(resPrim.text.includes('<root>'));
    const parsedPrim = xmlParser.parse(resPrim.text);
    assert.strictEqual(parsedPrim.success, true);
    assert.deepStrictEqual(parsedPrim.data.root.tags, ['alpha', 'beta', 'gamma']);

    // 3. TOML Array-of-Tables -> XML -> JSON Pipeline
    const tomlInput = '[[products]]\nid = 1\ntitle = "A"\n\n[[products]]\nid = 2\ntitle = "B"';
    const tomlParsed = tomlParser.parse(tomlInput);
    assert.strictEqual(tomlParsed.success, true);
    const tomlToXml = xmlParser.stringify(tomlParsed.data);
    assert.strictEqual(tomlToXml.success, true);
    const xmlToJson = xmlParser.parse(tomlToXml.text);
    assert.strictEqual(xmlToJson.success, true, 'XML generated from TOML array of tables must be valid single-root XML');
    assert.strictEqual(xmlToJson.data.root.products.length, 2);

    // 4. Non-array single-key object must retain clean non-wrapped root
    const singleObj = { book: { title: 'Clean Architecture', year: 2017 } };
    const resSingle = xmlParser.stringify(singleObj);
    assert.strictEqual(resSingle.success, true);
    assert.ok(!resSingle.text.includes('<root>'), 'Single-key non-array object must not be wrapped in <root>');
    assert.ok(resSingle.text.includes('<book>'));
  });

  test('XML: Namespace tags and attributes (<h:table>, xmlns:h="...") parse and stringify', () => {
    const namespacedXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<root xmlns:h="http://www.w3.org/TR/html4/" xmlns:f="https://www.w3schools.com/furniture">',
      '  <h:table border="1">',
      '    <h:tr>',
      '      <h:td>Apples</h:td>',
      '      <h:td>Bananas</h:td>',
      '    </h:tr>',
      '  </h:table>',
      '  <f:table>',
      '    <f:name>African Coffee Table</f:name>',
      '    <f:width>80</f:width>',
      '    <f:length>120</f:length>',
      '  </f:table>',
      '</root>'
    ].join('\n');

    const res = xmlParser.parse(namespacedXml);
    assert.strictEqual(res.success, true, `Namespaced XML parse failed: ${res.error && res.error.message}`);
    const root = res.data.root;
    assert.ok(root, 'Root element must exist');
    assert.strictEqual(root['@xmlns:h'], 'http://www.w3.org/TR/html4/');
    assert.strictEqual(root['@xmlns:f'], 'https://www.w3schools.com/furniture');

    assert.ok(root['h:table'], 'Element <h:table> must be parsed');
    assert.strictEqual(root['h:table']['@border'], 1);
    assert.deepStrictEqual(root['h:table']['h:tr']['h:td'], ['Apples', 'Bananas']);

    assert.ok(root['f:table'], 'Element <f:table> must be parsed');
    assert.strictEqual(root['f:table']['f:name'], 'African Coffee Table');
    assert.strictEqual(root['f:table']['f:width'], 80);

    // Serialization preservation check:
    const stringified = xmlParser.stringify(res.data);
    assert.strictEqual(stringified.success, true);
    assert.ok(stringified.text.includes('xmlns:h="http://www.w3.org/TR/html4/"'));
    assert.ok(stringified.text.includes('<h:table'));
    assert.ok(stringified.text.includes('<f:table'));

    const reParsed = xmlParser.parse(stringified.text);
    assert.strictEqual(reParsed.success, true);
    assert.strictEqual(reParsed.data.root['f:table']['f:name'], 'African Coffee Table');
  });

  // =========================================================================
  // SECTION 5: TOML Parser & Serializer
  // =========================================================================
  console.log('\n▶ [5/9] Testing TOML Parser & Serializer...');

  test('TOML: Standard tables, nested tables, dotted keys, and typed values', () => {
    const toml = `
# Server Configuration
title = "TOML Spec"
timeout = 30
pi = 3.14159
enabled = true
hex_num = 0xDEADBEEF
oct_num = 0o755
bin_num = 0b1010
date = 1979-05-27T07:32:00Z
"dotted.key" = "literal"

[database]
server = "192.168.1.1"
ports = [ 8001, 8002 ]
connection_max = 5_000

[database.credentials]
user = "admin"
`;
    const res = tomlParser.parse(toml);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.title, 'TOML Spec');
    assert.strictEqual(res.data.timeout, 30);
    assert.strictEqual(res.data.enabled, true);
    assert.strictEqual(res.data.hex_num, 0xDEADBEEF);
    assert.strictEqual(res.data.oct_num, 0o755);
    assert.strictEqual(res.data.bin_num, 10);
    assert.strictEqual(res.data['dotted.key'], 'literal');
    assert.strictEqual(res.data.database.server, '192.168.1.1');
    assert.strictEqual(res.data.database.connection_max, 5000);
    assert.deepStrictEqual(res.data.database.ports, [8001, 8002]);
    assert.strictEqual(res.data.database.credentials.user, 'admin');
  });

  test('TOML: Array of tables ([[products]])', () => {
    const toml = `
[[products]]
name = "Hammer"
sku = 738594937

[[products]]
name = "Nail"
sku = 284758393
color = "gray"
`;
    const res = tomlParser.parse(toml);
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data.products));
    assert.strictEqual(res.data.products.length, 2);
    assert.strictEqual(res.data.products[0].name, 'Hammer');
    assert.strictEqual(res.data.products[1].color, 'gray');
  });

  test('TOML: Multiline strings (""" and \'\'\')', () => {
    const toml = `
str1 = """
The quick brown \\
fox jumps over \\
the lazy dog."""

str2 = '''
First line
Second line'''
`;
    const res = tomlParser.parse(toml);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.str1, 'The quick brown fox jumps over the lazy dog.');
    assert.strictEqual(res.data.str2, 'First line\nSecond line');
  });

  test('TOML: Table ordering invariant during serialization', () => {
    const data = {
      app: 'OmniSync',
      server: { host: 'localhost', port: 8080 },
      users: [{ id: 1, name: 'Triet' }, { id: 2, name: 'Alice' }]
    };
    const res = tomlParser.stringify(data);
    assert.strictEqual(res.success, true);
    const text = res.text;

    // Check ordering: app = "OmniSync" must precede [server]
    const appPos = text.indexOf('app =');
    const serverPos = text.indexOf('[server]');
    const usersPos = text.indexOf('[[users]]');
    assert.ok(appPos !== -1 && serverPos !== -1 && usersPos !== -1);
    assert.ok(appPos < serverPos, 'Root scalars must precede sub-tables');
    assert.ok(serverPos < usersPos, 'Sub-tables must precede array of tables');

    // Round-trip check
    const back = tomlParser.parse(text);
    assert.strictEqual(back.data.app, 'OmniSync');
    assert.strictEqual(back.data.server.port, 8080);
    assert.strictEqual(back.data.users[0].name, 'Triet');
  });

  test('TOML: Syntax error locator', () => {
    const broken = 'title = "Hello"\nkey = \nnext = 1';
    const res = tomlParser.parse(broken);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error.line, 2);
    assert.ok(res.error.snippet.includes('^'));
  });

  // =========================================================================
  // SECTION 6: Canonical IR Engine
  // =========================================================================
  console.log('\n▶ [6/9] Testing Canonical IR Engine (ir.js)...');

  test('Canonical IR: Deep normalization with sorting, dates, BigInt, and circular guards', () => {
    const date = new Date('2026-11-05T07:00:00.000Z');
    const source = {
      b: 2,
      a: 1,
      d: date,
      big: BigInt(123),
      badNum: NaN,
      infNum: Infinity,
      undef: undefined
    };
    source.self = source; // Circular reference

    const normalized = IR.normalize(source, { sortKeys: true });
    assert.strictEqual(normalized.a, 1);
    assert.strictEqual(normalized.b, 2);
    assert.strictEqual(normalized.d, '2026-11-05T07:00:00.000Z');
    assert.strictEqual(normalized.big, 123);
    assert.strictEqual(normalized.badNum, null);
    assert.strictEqual(normalized.infNum, null);
    assert.strictEqual(normalized.undef, undefined); // stripped
    assert.strictEqual(normalized.self, '[Circular]');
    assert.deepStrictEqual(Object.keys(normalized), ['a', 'b', 'badNum', 'big', 'd', 'infNum', 'self']);
  });

  test('Canonical IR: Key-order independent semantic deepEquals', () => {
    const a = { x: 1, y: { foo: 'bar', list: [1, 2] } };
    const b = { y: { list: [1, 2], foo: 'bar' }, x: 1 };
    assert.strictEqual(IR.deepEquals(a, b), true);

    const c = { x: 1, y: { foo: 'bar', list: [1, 3] } };
    assert.strictEqual(IR.deepEquals(a, c), false);
  });

  test('Canonical IR: Deep cloning and structural statistics', () => {
    const tree = { name: 'OmniSync', meta: { count: 3, tags: ['a', 'b', 'c'], active: true } };
    const cloned = IR.clone(tree);
    assert.deepStrictEqual(cloned, tree);
    cloned.meta.count = 999;
    assert.strictEqual(tree.meta.count, 3, 'Mutation in clone must not affect original');

    const stats = IR.getStats(tree);
    assert.ok(stats.nodeCount >= 7);
    assert.strictEqual(stats.types.string, 4); // "OmniSync", "a", "b", "c"
    assert.strictEqual(stats.types.number, 1); // 3
    assert.strictEqual(stats.types.boolean, 1); // true
    assert.strictEqual(stats.types.array, 1);
    assert.strictEqual(stats.types.object, 2);
  });

  test('Canonical IR: Path navigation and RFC 6901 pointer parsing', () => {
    const data = { users: [{ name: 'Triet', 'work/home': 'HCM' }] };
    assert.strictEqual(IR.getAtPath(data, ['users', 0, 'name']), 'Triet');
    assert.strictEqual(IR.getAtPath(data, '/users/0/work~1home'), 'HCM');

    const segments = IR.parsePointer('/users/0/work~1home');
    assert.deepStrictEqual(segments, ['users', '0', 'work/home']);

    const pointer = IR.toPointer(['users', 0, 'work/home']);
    assert.strictEqual(pointer, '/users/0/work~1home');
  });

  // =========================================================================
  // SECTION 7: Tree Diff & Patch Engine
  // =========================================================================
  console.log('\n▶ [7/9] Testing Tree Diff & Patch Engine (diff.js)...');

  test('Diff: RFC 6902 JSON Patch generation (add, remove, replace)', () => {
    const original = { title: 'App', version: 1, tags: ['alpha'], oldField: true };
    const modified = { title: 'OmniSync', version: 2, tags: ['alpha', 'beta'], newField: 'hello' };

    const diffResult = Diff.compare(original, modified);
    assert.ok(diffResult.patches.length >= 4);
    assert.ok(diffResult.summary.includes('added'));
    assert.ok(diffResult.summary.includes('removed'));
    assert.ok(diffResult.summary.includes('modified'));

    // Check applyPatch reproduces modified tree
    const patched = Diff.applyPatch(original, diffResult.patches);
    assert.deepStrictEqual(patched, modified);
  });

  test('Diff: Array deletions emitted in reverse order for index integrity', () => {
    const origArr = { list: [10, 20, 30, 40] };
    const modArr = { list: [10, 20] };

    const diff = Diff.compare(origArr, modArr);
    const removals = diff.patches.filter(p => p.op === 'remove');
    assert.strictEqual(removals.length, 2);
    // Index 3 must be removed before index 2!
    assert.strictEqual(removals[0].path, '/list/3');
    assert.strictEqual(removals[1].path, '/list/2');

    const patched = Diff.applyPatch(origArr, diff.patches);
    assert.deepStrictEqual(patched, modArr);
  });

  test('Security: Prototype Pollution immunity across CSV, TOML, IR, and Diff', () => {
    const canaries = ['pollutedCsv', 'pollutedToml', 'pollutedIr', 'pollutedDiff', 'admin'];

    // Clean initial state
    for (const c of canaries) {
      delete Object.prototype[c];
    }

    try {
      // 1. CSV Prototype Pollution Attack
      const csvAttack = '__proto__.pollutedCsv,constructor.prototype.pollutedCsv,val\nyes,yes,1';
      csvParser.parse(csvAttack);
      assert.strictEqual(({}).pollutedCsv, undefined, 'CSV unflattenObject must not pollute Object.prototype');
      assert.strictEqual(Object.prototype.pollutedCsv, undefined, 'Object.prototype.pollutedCsv must be undefined');

      // 2. TOML Prototype Pollution Attack
      const tomlTableAttack = '[__proto__]\npollutedToml = "breached"\n\n[constructor.prototype]\npollutedToml = "breached"';
      tomlParser.parse(tomlTableAttack);
      assert.strictEqual(({}).pollutedToml, undefined, 'TOML table navigation must not pollute Object.prototype');

      const tomlDottedAttack = '__proto__.pollutedToml = true';
      tomlParser.parse(tomlDottedAttack);
      assert.strictEqual(({}).pollutedToml, undefined, 'TOML dotted key must not pollute Object.prototype');

      // 3. IR setAtPath Prototype Pollution Attack
      const irTarget = {};
      IR.setAtPath(irTarget, '/__proto__/pollutedIr', 'breached');
      IR.setAtPath(irTarget, ['constructor', 'prototype', 'pollutedIr'], 'breached');
      assert.strictEqual(({}).pollutedIr, undefined, 'IR.setAtPath must not pollute Object.prototype');
      assert.strictEqual(Object.prototype.pollutedIr, undefined);

      // 4. Diff applyPatch Prototype Pollution Attack
      const diffTarget = {};
      try {
        Diff.applyPatch(diffTarget, [
          { op: 'add', path: '/__proto__/pollutedDiff', value: 'breached' },
          { op: 'replace', path: '/constructor/prototype/pollutedDiff', value: 'breached' }
        ]);
      } catch (_) {
        // Safe rejection with error is acceptable behavior
      }
      assert.strictEqual(({}).pollutedDiff, undefined, 'Diff.applyPatch must not pollute Object.prototype');
      assert.strictEqual(Object.prototype.pollutedDiff, undefined);

    } finally {
      // Cleanup
      for (const c of canaries) {
        delete Object.prototype[c];
      }
    }
  });

  test('Security: Detailed CSV unflattenObject rejects __proto__ and constructor.prototype', () => {
    delete Object.prototype.polluted;
    delete Object.prototype.admin;
    try {
      const csv1 = '__proto__.polluted,val\nyes,1';
      const res1 = csvParser.parse(csv1);
      assert.strictEqual(res1.success, true);
      assert.strictEqual(({}).polluted, undefined, 'Object.prototype must not be polluted by __proto__ in CSV');

      const csv2 = 'constructor.prototype.admin,val\nyes,1';
      const res2 = csvParser.parse(csv2);
      assert.strictEqual(res2.success, true);
      assert.strictEqual(({}).admin, undefined, 'Object.prototype must not be polluted by constructor.prototype in CSV');
    } finally {
      delete Object.prototype.polluted;
      delete Object.prototype.admin;
    }
  });

  test('Security: Detailed TOML table and dotted keys reject __proto__ and constructor.prototype', () => {
    delete Object.prototype.polluted;
    delete Object.prototype.dottedPolluted;
    delete Object.prototype.inlinePolluted;
    try {
      const toml1 = '[__proto__]\npolluted = true';
      const res1 = tomlParser.parse(toml1);
      assert.strictEqual(res1.success, true);
      assert.strictEqual(({}).polluted, undefined, 'Object.prototype must not be polluted by [__proto__] table');

      const toml2 = '__proto__.dottedPolluted = true';
      const res2 = tomlParser.parse(toml2);
      assert.strictEqual(res2.success, true);
      assert.strictEqual(({}).dottedPolluted, undefined, 'Object.prototype must not be polluted by dotted __proto__');

      const toml3 = 'item = { __proto__ = { inlinePolluted = true } }';
      const res3 = tomlParser.parse(toml3);
      assert.strictEqual(res3.success, true);
      assert.strictEqual(({}).inlinePolluted, undefined, 'Object.prototype must not be polluted by inline table __proto__');
    } finally {
      delete Object.prototype.polluted;
      delete Object.prototype.dottedPolluted;
      delete Object.prototype.inlinePolluted;
    }
  });

  test('Security: Detailed IR setAtPath and getAtPath reject traversal through unsafe keys', () => {
    delete Object.prototype.polluted;
    delete Object.prototype.admin;
    try {
      IR.setAtPath({}, '__proto__/polluted', true);
      assert.strictEqual(({}).polluted, undefined, 'Object.prototype must not be polluted by string path __proto__');

      IR.setAtPath({}, ['__proto__', 'polluted'], true);
      assert.strictEqual(({}).polluted, undefined, 'Object.prototype must not be polluted by array path __proto__');

      IR.setAtPath({}, ['constructor', 'prototype', 'admin'], true);
      assert.strictEqual(({}).admin, undefined, 'Object.prototype must not be polluted by constructor.prototype');

      const val = IR.getAtPath({}, '/__proto__');
      assert.strictEqual(val, undefined, 'IR.getAtPath must not leak Object.prototype');
    } finally {
      delete Object.prototype.polluted;
      delete Object.prototype.admin;
    }
  });

  test('Security: Detailed Diff applyPatch rejects patches targeting __proto__ or constructor', () => {
    delete Object.prototype.diffPolluted;
    delete Object.prototype.admin;
    try {
      Diff.applyPatch({}, [{ op: 'add', path: '/__proto__/diffPolluted', value: 'danger' }]);
      assert.strictEqual(({}).diffPolluted, undefined, 'Diff.applyPatch must not pollute Object.prototype via add');

      Diff.applyPatch({}, [{ op: 'replace', path: '/__proto__/diffPolluted', value: 'danger' }]);
      assert.strictEqual(({}).diffPolluted, undefined, 'Diff.applyPatch must not pollute Object.prototype via replace');

      Diff.applyPatch({}, [{ op: 'add', path: '/constructor/prototype/admin', value: 'danger' }]);
      assert.strictEqual(({}).admin, undefined, 'Diff.applyPatch must not pollute Object.prototype via constructor.prototype');
    } finally {
      delete Object.prototype.diffPolluted;
      delete Object.prototype.admin;
    }
  });

  // =========================================================================
  // SECTION 8: Diagnostic Locator & Schema Validator
  // =========================================================================
  console.log('\n▶ [8/9] Testing Diagnostic Locator & Validator (validator.js)...');

  test('Validator: Position to line and column coordinate mapping', () => {
    const sample = 'Line 1\nLine 2 is longer\nLine 3';
    // Offset of 'is' on Line 2:
    const offset = 'Line 1\nLine 2 '.length;
    const coords = Validator.positionToCoordinates(sample, offset);
    assert.strictEqual(coords.line, 2);
    assert.strictEqual(coords.column, 8);
  });

  test('Validator: 3-line visual caret frame generation', () => {
    const code = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const frame = Validator.generateCodeFrame(code, 2, 7, 'Unexpected token');
    assert.ok(frame.includes('const b = 2;'));
    assert.ok(frame.includes('> '));
    assert.ok(frame.includes('^ Unexpected token'));
  });

  test('Validator: JSON Schema validation (Draft-07 subset)', () => {
    const schema = {
      type: 'object',
      required: ['id', 'email', 'age'],
      properties: {
        id: { type: 'integer', minimum: 1 },
        email: { type: 'string', minLength: 5, pattern: '@' },
        age: { type: 'number', minimum: 18, maximum: 120 },
        tags: { type: 'array', minItems: 1, items: { type: 'string' } }
      }
    };

    const validData = { id: 10, email: 'triet@example.com', age: 25, tags: ['core'] };
    const validCheck = Validator.validateSchema(schema, validData);
    assert.strictEqual(validCheck.valid, true);
    assert.strictEqual(validCheck.errors.length, 0);

    const invalidData = { id: 0, email: 'bad', age: 15, tags: [] };
    const invalidCheck = Validator.validateSchema(schema, invalidData);
    assert.strictEqual(invalidCheck.valid, false);
    assert.ok(invalidCheck.errors.some(e => e.keyword === 'minimum'));
    assert.ok(invalidCheck.errors.some(e => e.keyword === 'pattern'));
    assert.ok(invalidCheck.errors.some(e => e.keyword === 'minItems'));
  });

  test('Validator: Cross-format compatibility notices', () => {
    const nested = { user: { address: { city: 'HCMC' } } };
    const csvWarn = Validator.getCompatibilityWarnings('json', 'csv', nested);
    assert.ok(csvWarn.some(w => w.includes('flattened')));

    const arr = [1, 2, 3];
    const tomlWarn = Validator.getCompatibilityWarnings('json', 'toml', arr);
    assert.ok(tomlWarn.some(w => w.includes('items')));
  });

  // =========================================================================
  // SECTION 9: Bidirectional Sync Engine
  // =========================================================================
  console.log('\n▶ [9/9] Testing Bidirectional Sync Engine (sync.js)...');

  test('SyncEngine: Immediate conversion across all 20 format pairs', () => {
    const engine = new SyncEngine();
    const formats = ['json', 'yaml', 'csv', 'xml', 'toml'];
    const sampleData = [
      { id: 1, name: 'Triet', role: 'Dev' },
      { id: 2, name: 'Alice', role: 'Lead' }
    ];

    // Seed format is JSON
    const jsonStr = jsonParser.stringify(sampleData).text;

    for (let fromF of formats) {
      for (let toF of formats) {
        if (fromF === toF) continue;
        const conv = engine.convertImmediate(jsonStr, 'json', fromF);
        assert.strictEqual(conv.success, true, `Conversion json -> ${fromF} failed`);

        const pairConv = engine.convertImmediate(conv.result, fromF, toF);
        assert.strictEqual(pairConv.success, true, `Pairwise conversion ${fromF} -> ${toF} failed: ${pairConv.error && pairConv.error.message}`);
        assert.ok(pairConv.result.length > 0);
      }
    }
  });

  await testAsync('SyncEngine: Debounced input execution, event dispatch & stats', () => {
    return new Promise((resolve, reject) => {
      let syncCount = 0;
      const engine = new SyncEngine({
        debounceMs: 50,
        onSync: (payload) => {
          syncCount++;
          try {
            assert.strictEqual(payload.sourcePane, 'left');
            assert.strictEqual(payload.targetPane, 'right');
            assert.strictEqual(payload.sourceFormat, 'json');
            assert.strictEqual(payload.targetFormat, 'yaml');
            assert.ok(payload.text.includes('name: OmniSync'));
            assert.ok(payload.stats.nodeCount >= 2);
            assert.strictEqual(syncCount, 1, 'Debounce should coalesce rapid inputs into exactly 1 sync');
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      });

      // Rapidly fire 5 keystrokes within 20ms
      engine.handleInput('left', '{"name": "Omn', 'json', 'yaml');
      engine.handleInput('left', '{"name": "Omni', 'json', 'yaml');
      engine.handleInput('left', '{"name": "OmniSync', 'json', 'yaml');
      engine.handleInput('left', '{"name": "OmniSync"}', 'json', 'yaml');
    });
  });

  await testAsync('SyncEngine: Non-destructive syntax error containment', () => {
    return new Promise((resolve, reject) => {
      let errorFired = false;
      let syncFiredAfterError = false;

      const engine = new SyncEngine({
        debounceMs: 30,
        onSync: (payload) => {
          syncFiredAfterError = true;
          try {
            assert.strictEqual(payload.ir.fixed, true);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        onError: (errPayload) => {
          errorFired = true;
          try {
            assert.strictEqual(errPayload.sourcePane, 'left');
            assert.ok(errPayload.error.line >= 1);
            assert.strictEqual(engine.state, 'ERROR');

            // Now immediately fix the syntax
            engine.handleInput('left', '{"fixed": true}', 'json', 'yaml');
          } catch (e) {
            reject(e);
          }
        }
      });

      // Type broken JSON
      engine.handleInput('left', '{\n  "broken": \n}', 'json', 'yaml');
    });
  });

  test('SyncEngine: Semantic equivalence loop breaker (deepEquals guard)', () => {
    let syncCallCount = 0;
    const engine = new SyncEngine({
      onSync: () => { syncCallCount++; }
    });

    // 1st conversion sets lastSyncedIR
    engine.executeSync('left', '{"a": 1, "b": 2}', 'json', 'yaml');
    assert.strictEqual(syncCallCount, 1);

    // 2nd input with purely cosmetic reordering or formatting
    engine.executeSync('left', '{\n  "b": 2,\n  "a": 1\n}', 'json', 'yaml');
    assert.strictEqual(syncCallCount, 1, 'Semantic identity must break loop and skip serialization!');
    assert.strictEqual(engine.state, 'SYNCED');
  });

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log('\n===============================================================');
  console.log(`  Verification Complete: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

/**
 * OmniSync Studio - Challenger 1 Stress & Empirical Verification Test Suite
 * Milestone 1: Conversion & Sync Core Engine
 * 
 * Verifies:
 * 1. Deep round-trips: JSON <-> YAML <-> TOML <-> XML <-> CSV across complex datasets.
 * 2. Large datasets & nested structures (15+ levels nesting, 600+ array items).
 * 3. Unicode support: Vietnamese accents, emojis, special symbols.
 * 4. Line/column error locator accuracy on malformed inputs for all 5 parsers.
 * 5. Adversarial edge cases: YAML Norway problem, type preservation, empty/null safety.
 * 6. SyncEngine end-to-end integration, debouncing, and non-destructive isolation.
 * 7. Advanced parser features: CSV RFC 4180 multiline, XML CDATA/BadgerFish, TOML inline tables.
 * 8. Tree Diff engine & RFC 6902 patch generation.
 * 9. JSON Schema validation (Draft-07 subset) in validator.js.
 */

'use strict';

const path = require('path');
const jsonParser = require('../js/parsers/json.js');
const yamlParser = require('../js/parsers/yaml.js');
const csvParser = require('../js/parsers/csv.js');
const xmlParser = require('../js/parsers/xml.js');
const tomlParser = require('../js/parsers/toml.js');

const IR = require('../js/engine/ir.js');
const Diff = require('../js/engine/diff.js');
const Validator = require('../js/engine/validator.js');
const SyncEngine = require('../js/engine/sync.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message, details) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✖ FAIL: ${message}`);
    if (details) {
      console.error(`    Details: ${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}`);
    }
    failures.push({ message, details });
  }
}

async function runAllSuites() {
  console.log(`===============================================================`);
  console.log(`  OmniSync Studio — Milestone 1 Challenger 1 Empirical Suite  `);
  console.log(`===============================================================`);

  // ===============================================================
  // SUITE 1: Unicode & Vietnamese Fidelity
  // ===============================================================
  console.log(`\n▶ SUITE 1: Unicode & Vietnamese Fidelity (Diacritics, Emojis, Symbols)`);
  {
    const vietnameseDataset = {
      user: {
        fullName: 'Nguyễn Minh Triết',
        birthDate: '2008-05-25',
        university: 'Đại học Bách Khoa TP.HCM (HCMUT)',
        department: 'Khoa Điện - Điện tử',
        hometown: {
          district: 'Cái Nước',
          province: 'Cà Mau',
          address: 'Ngã tư đầu lộ Phú Mỹ, hướng về đường xuống VLXD Thanh Liêm'
        },
        interests: ['Chơi game 🎮', 'Xem YouTube ▶️', 'Hoạt hình 🎌', 'Nghe audio 🎧'],
        philosophy: 'Con người là danh xưng của một giống loài đa dạng, mỗi cá thể đều mang linh hồn và bản chất riêng biệt.',
        symbols: '© ® ™ 🇻🇳 ★ ⚡ 🚀 ✨ ➔ ∑ ∏ ∫ ≤ ≥ ≠ ≈'
      }
    };

    // 1.1 JSON Unicode Fidelity
    const jsonRes = jsonParser.stringify(vietnameseDataset);
    assert(jsonRes.success, 'JSON: Stringify Vietnamese dataset successfully');
    const jsonParsed = jsonParser.parse(jsonRes.text);
    assert(jsonParsed.success, 'JSON: Parse Vietnamese dataset successfully');
    assert(IR.deepEquals(jsonParsed.data, vietnameseDataset), 'JSON: Semantic identity preserved with Vietnamese Unicode');

    // 1.2 YAML Unicode Fidelity
    const yamlRes = yamlParser.stringify(vietnameseDataset);
    assert(yamlRes.success, 'YAML: Stringify Vietnamese dataset successfully');
    const yamlParsed = yamlParser.parse(yamlRes.text);
    assert(yamlParsed.success, 'YAML: Parse Vietnamese dataset successfully');
    assert(yamlParsed.data.user.fullName === 'Nguyễn Minh Triết', 'YAML: Preserves fullName with diacritics');
    assert(yamlParsed.data.user.hometown.district === 'Cái Nước', 'YAML: Preserves district with diacritics');
    assert(yamlParsed.data.user.interests[0].includes('🎮'), 'YAML: Preserves emojis in list');

    // 1.3 TOML Unicode Fidelity
    const tomlRes = tomlParser.stringify(vietnameseDataset);
    assert(tomlRes.success, 'TOML: Stringify Vietnamese dataset successfully');
    const tomlParsed = tomlParser.parse(tomlRes.text);
    assert(tomlParsed.success, 'TOML: Parse Vietnamese dataset successfully');
    assert(tomlParsed.data.user.fullName === 'Nguyễn Minh Triết', 'TOML: Preserves fullName with diacritics');
    assert(tomlParsed.data.user.university.includes('TP.HCM'), 'TOML: Preserves university with diacritics');
    assert(tomlParsed.data.user.symbols.includes('🇻🇳'), 'TOML: Preserves flags and math symbols');

    // 1.4 XML Unicode Fidelity
    const xmlRes = xmlParser.stringify(vietnameseDataset);
    assert(xmlRes.success, 'XML: Stringify Vietnamese dataset successfully');
    const xmlParsed = xmlParser.parse(xmlRes.text);
    assert(xmlParsed.success, 'XML: Parse Vietnamese dataset successfully');
    const xmlRoot = xmlParsed.data.user || (xmlParsed.data.root && xmlParsed.data.root.user);
    assert(xmlRoot && xmlRoot.fullName === 'Nguyễn Minh Triết', 'XML: Preserves fullName with diacritics');
    assert(xmlRoot && xmlRoot.hometown && xmlRoot.hometown.province === 'Cà Mau', 'XML: Preserves province with diacritics');

    // 1.5 CSV Unicode Fidelity
    const csvList = [
      {
        id: 1,
        name: 'Nguyễn Minh Triết',
        location: 'Cái Nước, Cà Mau',
        university: 'Đại học Bách Khoa TP.HCM'
      },
      {
        id: 2,
        name: 'Lê Văn Tám',
        location: 'Quận 1, TP. Hồ Chí Minh',
        university: 'Đại học Khoa học Tự nhiên'
      }
    ];
    const csvRes = csvParser.stringify(csvList);
    assert(csvRes.success, 'CSV: Stringify Vietnamese records successfully');
    const csvParsed = csvParser.parse(csvRes.text);
    assert(csvParsed.success, 'CSV: Parse Vietnamese records successfully');
    assert(csvParsed.data.length === 2, 'CSV: 2 records parsed back');
    assert(csvParsed.data[0].name === 'Nguyễn Minh Triết', 'CSV: Preserves row 1 Vietnamese name');
    assert(csvParsed.data[0].location === 'Cái Nước, Cà Mau', 'CSV: Preserves comma-separated address in quotes');
  }

  // ===============================================================
  // SUITE 2: Deep Nesting & Large Scale Stress
  // ===============================================================
  console.log(`\n▶ SUITE 2: Deep Nesting & Large Scale Stress (15 levels, 600 items)`);
  {
    // 2.1 Deep Nesting: 15 levels
    let deepObj = { leafValue: 'OmniSyncDeepProbe', level: 15, valid: true };
    for (let i = 14; i >= 1; i--) {
      deepObj = { level: i, nested: deepObj };
    }

    // JSON deep nesting
    const jsonDeep = jsonParser.stringify(deepObj);
    const jsonParsedDeep = jsonParser.parse(jsonDeep.text);
    assert(jsonParsedDeep.success, 'JSON: Handles 15 levels of deep nesting');
    assert(IR.deepEquals(jsonParsedDeep.data, deepObj), 'JSON: Deep nesting data preserved 100%');

    // YAML deep nesting
    const yamlDeep = yamlParser.stringify(deepObj);
    assert(yamlDeep.success, 'YAML: Stringify 15 levels deep nesting');
    const yamlParsedDeep = yamlParser.parse(yamlDeep.text);
    assert(yamlParsedDeep.success, 'YAML: Parse 15 levels deep nesting');
    assert(IR.deepEquals(yamlParsedDeep.data, deepObj), 'YAML: Deep nesting data preserved 100%');

    // XML deep nesting
    const xmlDeep = xmlParser.stringify(deepObj);
    assert(xmlDeep.success, 'XML: Stringify 15 levels deep nesting');
    const xmlParsedDeep = xmlParser.parse(xmlDeep.text);
    assert(xmlParsedDeep.success, 'XML: Parse 15 levels deep nesting');

    // CSV unflattening deep nesting
    const csvFlat = csvParser.stringify(deepObj);
    assert(csvFlat.success, 'CSV: Stringify 15 levels deep nesting via dot notation');
    const csvParsedDeep = csvParser.parse(csvFlat.text);
    assert(csvParsedDeep.success, 'CSV: Parse 15 levels deep nesting via dot notation');
    let cur = Array.isArray(csvParsedDeep.data) ? csvParsedDeep.data[0] : csvParsedDeep.data;
    for (let i = 1; i <= 14; i++) {
      cur = cur.nested;
    }
    assert(cur && cur.leafValue === 'OmniSyncDeepProbe', 'CSV: Reconstructs 15 levels deep nesting from dot paths');

    // 2.2 Scale Stress: 600 array items
    const items = [];
    for (let i = 1; i <= 600; i++) {
      items.push({
        id: i,
        code: `ITEM-${String(i).padStart(4, '0')}`,
        active: i % 2 === 0,
        score: Number((i * 1.5).toFixed(2)),
        tags: [`tag${i % 5}`, `group${i % 10}`]
      });
    }

    const t0 = Date.now();
    // JSON scale
    const jsonItemsStr = jsonParser.stringify(items);
    const jsonItemsParsed = jsonParser.parse(jsonItemsStr.text);
    assert(jsonItemsParsed.success && jsonItemsParsed.data.length === 600, 'JSON: Handles 600 items rapidly');

    // CSV scale
    const csvItemsStr = csvParser.stringify(items);
    const csvItemsParsed = csvParser.parse(csvItemsStr.text);
    assert(csvItemsParsed.success && csvItemsParsed.data.length === 600, 'CSV: Handles 600 items serialization & parsing');

    // YAML scale
    const yamlItemsStr = yamlParser.stringify(items);
    const yamlItemsParsed = yamlParser.parse(yamlItemsStr.text);
    assert(yamlItemsParsed.success && yamlItemsParsed.data.length === 600, 'YAML: Handles 600 items list parsing');

    // TOML scale (Array of tables)
    const tomlItemsStr = tomlParser.stringify({ products: items });
    assert(tomlItemsStr.success, 'TOML: Stringify 600 array of tables');
    const tomlItemsParsed = tomlParser.parse(tomlItemsStr.text);
    assert(tomlItemsParsed.success && tomlItemsParsed.data.products.length === 600, 'TOML: Parse 600 array of tables');

    const duration = Date.now() - t0;
    assert(duration < 2000, `Scale test completed in ${duration}ms (< 2000ms threshold)`);
  }

  // ===============================================================
  // SUITE 3: Cross-Format Conversion Matrix (All 20 Pairs)
  // ===============================================================
  console.log(`\n▶ SUITE 3: Cross-Format Conversion Matrix (20 Inter-format Pairs)`);
  {
    const sync = new SyncEngine();
    const formats = ['json', 'yaml', 'csv', 'xml', 'toml'];

    const testRecord = [
      { id: 101, name: 'Alice Smith', role: 'Engineer', salary: 95000 },
      { id: 102, name: 'Bob Jones', role: 'Designer', salary: 88000 },
      { id: 103, name: 'Charlie Brown', role: 'Manager', salary: 110000 }
    ];

    const seedJson = JSON.stringify(testRecord, null, 2);

    let successPairs = 0;
    for (const src of formats) {
      for (const dst of formats) {
        if (src === dst) continue;

        const prep = sync.convertImmediate(seedJson, 'json', src);
        assert(prep.success, `Prep seed data from json -> ${src}`);
        if (!prep.success) continue;

        const res = sync.convertImmediate(prep.result, src, dst);
        assert(res.success, `Matrix conversion: ${src.toUpperCase()} -> ${dst.toUpperCase()}`);
        if (res.success) {
          successPairs++;
        }
      }
    }

    assert(successPairs === 20, `All 20 format pairs converted successfully (${successPairs}/20)`);
  }

  // ===============================================================
  // SUITE 4: Bidirectional Round-Trip Invariants
  // ===============================================================
  console.log(`\n▶ SUITE 4: Bidirectional Round-Trip Invariants`);
  {
    const sync = new SyncEngine();

    // 4.1 JSON -> YAML -> JSON
    const complexData = {
      app: 'OmniSync Studio',
      version: '1.0.0',
      features: ['Real-time sync', 'Multi-format', 'Zero-dep'],
      settings: {
        theme: 'dark',
        debounce: 250,
        autoSave: true,
        maxHistory: 100
      },
      metadata: {
        tags: ['converter', 'sync', 'tool'],
        author: {
          name: 'Nguyễn Minh Triết',
          id: 2026
        }
      }
    };

    const c1 = sync.convertImmediate(JSON.stringify(complexData), 'json', 'yaml');
    assert(c1.success, 'Round-trip 1: JSON -> YAML successful');
    const c2 = sync.convertImmediate(c1.result, 'yaml', 'json');
    assert(c2.success, 'Round-trip 1: YAML -> JSON successful');
    const r1Data = JSON.parse(c2.result);
    assert(IR.deepEquals(r1Data, complexData), 'Round-trip 1: Semantic equality JSON <-> YAML preserved 100%');

    // 4.2 JSON -> TOML -> JSON
    const tomlCompatibleData = {
      title: 'OmniSync Config',
      owner: {
        name: 'Nguyễn Minh Triết',
        active: true,
        score: 99.5
      },
      database: {
        server: '192.168.1.1',
        ports: [8000, 8001, 8002],
        connection_max: 5000,
        enabled: true
      }
    };

    const t1 = sync.convertImmediate(JSON.stringify(tomlCompatibleData), 'json', 'toml');
    assert(t1.success, 'Round-trip 2: JSON -> TOML successful');
    const t2 = sync.convertImmediate(t1.result, 'toml', 'json');
    assert(t2.success, 'Round-trip 2: TOML -> JSON successful');
    const r2Data = JSON.parse(t2.result);
    assert(IR.deepEquals(r2Data, tomlCompatibleData), 'Round-trip 2: Semantic equality JSON <-> TOML preserved 100%');

    // 4.3 JSON -> CSV -> JSON (Tabular data with dot-notation)
    const tabularData = [
      { sku: 'A1', product: { title: 'Keyboard', price: 79.99 }, inStock: true },
      { sku: 'A2', product: { title: 'Mouse', price: 49.5 }, inStock: false },
      { sku: 'A3', product: { title: 'Monitor', price: 299.0 }, inStock: true }
    ];

    const csv1 = sync.convertImmediate(JSON.stringify(tabularData), 'json', 'csv');
    assert(csv1.success, 'Round-trip 3: JSON -> CSV successful');
    const csv2 = sync.convertImmediate(csv1.result, 'csv', 'json');
    assert(csv2.success, 'Round-trip 3: CSV -> JSON successful');
    const r3Data = JSON.parse(csv2.result);
    assert(IR.deepEquals(r3Data, tabularData), 'Round-trip 3: Semantic equality JSON <-> CSV with nested fields preserved 100%');
  }

  // ===============================================================
  // SUITE 5: Line / Column Error Coordinates Precision
  // ===============================================================
  console.log(`\n▶ SUITE 5: Line / Column Error Coordinate Precision Across Parsers`);
  {
    // 5.1 JSON Error Coordinates
    const badJson = '{\n  "valid": 123,\n  "broken": [1, 2, , 4]\n}';
    const jsonErr = jsonParser.parse(badJson);
    assert(!jsonErr.success, 'JSON: Detects malformed syntax');
    assert(jsonErr.error && jsonErr.error.line === 3, `JSON: Accurately identifies line 3 (actual: ${jsonErr.error && jsonErr.error.line})`);
    assert(jsonErr.error && jsonErr.error.snippet && jsonErr.error.snippet.includes('^'), 'JSON: Produces caret code frame');

    // 5.2 YAML Error Coordinates (Tab violation)
    const badYamlTab = 'title: Test\ndetails:\n\tinvalidTab: true';
    const yamlErr = yamlParser.parse(badYamlTab);
    assert(!yamlErr.success, 'YAML: Rejects tab indentation');
    assert(yamlErr.error && yamlErr.error.line === 3, `YAML: Accurately identifies line 3 (actual: ${yamlErr.error && yamlErr.error.line})`);
    assert(yamlErr.error && yamlErr.error.column === 1, `YAML: Identifies column 1 for tab (actual: ${yamlErr.error && yamlErr.error.column})`);

    // 5.3 CSV Error Coordinates (Unterminated quote)
    const badCsv = 'id,name,city\n1,"Unclosed quote,Hanoi\n2,Bob,Danang';
    const csvErr = csvParser.parse(badCsv);
    assert(!csvErr.success, 'CSV: Detects unclosed quote');
    assert(csvErr.error && csvErr.error.line === 2, `CSV: Identifies unclosed quote at line 2 (actual: ${csvErr.error && csvErr.error.line})`);
    assert(csvErr.error && csvErr.error.column === 3, `CSV: Identifies unclosed quote at column 3 (actual: ${csvErr.error && csvErr.error.column})`);

    // 5.4 XML Error Coordinates (Mismatched tag)
    const badXml = '<root>\n  <item>Valid</item>\n  <wrong>Text</mismatched>\n</root>';
    const xmlErr = xmlParser.parse(badXml);
    assert(!xmlErr.success, 'XML: Detects mismatched tag');
    assert(xmlErr.error && xmlErr.error.line === 3, `XML: Identifies mismatched tag at line 3 (actual: ${xmlErr.error && xmlErr.error.line})`);
    assert(xmlErr.error && xmlErr.error.message.includes('mismatched'), 'XML: Error message specifies tag mismatch');

    // 5.5 TOML Error Coordinates (Missing equals sign)
    const badToml = '[section]\nkey1 = "val1"\nbroken_line_without_equal\nkey2 = "val2"';
    const tomlErr = tomlParser.parse(badToml);
    assert(!tomlErr.success, 'TOML: Detects missing equals syntax');
    assert(tomlErr.error && tomlErr.error.line === 3, `TOML: Identifies error at line 3 (actual: ${tomlErr.error && tomlErr.error.line})`);
  }

  // ===============================================================
  // SUITE 6: Adversarial Boundary Cases & Edge Scenarios
  // ===============================================================
  console.log(`\n▶ SUITE 6: Adversarial Boundary Cases & Edge Scenarios`);
  {
    // 6.1 YAML Quote Safety ("The Norway Problem")
    const norwayObj = {
      countryCode: 'NO',
      answer: 'yes',
      status: 'true',
      zipCode: '0123'
    };
    const yamlOut = yamlParser.stringify(norwayObj);
    assert(yamlOut.success, 'YAML: Stringifies strings vulnerable to Norway Problem');
    const yamlIn = yamlParser.parse(yamlOut.text);
    assert(yamlIn.success, 'YAML: Parses output back');
    assert(typeof yamlIn.data.countryCode === 'string' && yamlIn.data.countryCode === 'NO', 'YAML: "NO" preserved as string (Norway Problem protected)');
    assert(typeof yamlIn.data.answer === 'string' && yamlIn.data.answer === 'yes', 'YAML: "yes" preserved as string');
    assert(typeof yamlIn.data.status === 'string' && yamlIn.data.status === 'true', 'YAML: "true" preserved as string');

    // 6.2 Null and Empty String Tolerances
    assert(jsonParser.parse('').success, 'JSON: Empty string returns success with empty data');
    assert(yamlParser.parse('').success, 'YAML: Empty string returns success with empty data');
    assert(csvParser.parse('').success, 'CSV: Empty string returns success with empty data');
    assert(xmlParser.parse('').success, 'XML: Empty string returns success with empty data');
    assert(tomlParser.parse('').success, 'TOML: Empty string returns success with empty data');

    // Whitespace-only string tolerance
    assert(jsonParser.parse('   \n  \t  ').success, 'JSON: Whitespace-only returns success');
    assert(yamlParser.parse('   \n  \t  ').success, 'YAML: Whitespace-only returns success');
    assert(csvParser.parse('   \n  \t  ').success, 'CSV: Whitespace-only returns success');
    assert(xmlParser.parse('   \n  \t  ').success, 'XML: Whitespace-only returns success');
    assert(tomlParser.parse('   \n  \t  ').success, 'TOML: Whitespace-only returns success');

    // Non-string input safety
    assert(!jsonParser.parse(null).success, 'JSON: Null input cleanly rejected');
    assert(!yamlParser.parse(null).success, 'YAML: Null input cleanly rejected');
    assert(!csvParser.parse(null).success, 'CSV: Null input cleanly rejected');
    assert(!xmlParser.parse(null).success, 'XML: Null input cleanly rejected');

    // Circular reference detection in JSON / IR
    const circ = { name: 'Circ' };
    circ.self = circ;
    const jsonCirc = jsonParser.stringify(circ);
    assert(!jsonCirc.success, 'JSON: Circular reference detected during stringify without crash');

    const normalizedCirc = IR.normalize(circ);
    assert(normalizedCirc.self === '[Circular]', 'IR: Circular reference normalized to [Circular]');

    // BigInt handling
    const bigIntData = { val: BigInt(9007199254740991) };
    const jsonBigInt = jsonParser.stringify(bigIntData);
    assert(jsonBigInt.success, 'JSON: BigInt stringified safely');
  }

  // ===============================================================
  // SUITE 7: SyncEngine Lifecycle, Non-Destructive Isolation & FSM
  // ===============================================================
  console.log(`\n▶ SUITE 7: SyncEngine Lifecycle, Non-Destructive Isolation & FSM`);
  await new Promise((resolve) => {
    let statusHistory = [];
    let syncHistory = [];
    let errorHistory = [];

    const engine = new SyncEngine({
      debounceMs: 50,
      onStatusChange: (status) => statusHistory.push(status),
      onSync: (ev) => syncHistory.push(ev),
      onError: (ev) => errorHistory.push(ev)
    });

    assert(engine.state === 'IDLE', 'SyncEngine: Initial state is IDLE');

    const initialJson = '{\n  "greeting": "Xin chào thế giới",\n  "count": 42\n}';
    engine.handleInput('left', initialJson, 'json', 'yaml');
    assert(engine.state === 'EDITING', 'SyncEngine: Switches to EDITING on input');

    setTimeout(() => {
      assert(engine.state === 'SYNCED', 'SyncEngine: Transitions to SYNCED after execution');
      assert(syncHistory.length === 1, 'SyncEngine: onSync called exactly once');
      assert(syncHistory[0].targetPane === 'right', 'SyncEngine: Targets right pane');
      assert(syncHistory[0].text.includes('Xin chào thế giới'), 'SyncEngine: Transformed text in target pane');

      // Syntax error in left pane
      const brokenJson = '{\n  "greeting": "Xin chào",\n  broken\n}';
      engine.handleInput('left', brokenJson, 'json', 'yaml');

      setTimeout(() => {
        assert(engine.state === 'ERROR', 'SyncEngine: Transitions to ERROR on syntax error');
        assert(errorHistory.length === 1, 'SyncEngine: onError fired');
        assert(errorHistory[0].error.line === 3, 'SyncEngine: Error coordinate pinpointed to line 3');
        assert(syncHistory.length === 1, 'SyncEngine: NON-DESTRUCTIVE ISOLATION: peer pane was NOT overwritten on error');

        // Retyped equivalent JSON
        const retypedEquivalentJson = '{\n  "count": 42,\n  "greeting": "Xin chào thế giới"\n}';
        engine.handleInput('left', retypedEquivalentJson, 'json', 'yaml');

        setTimeout(() => {
          assert(engine.state === 'SYNCED', 'SyncEngine: Re-synced after fix');
          resolve();
        }, 80);
      }, 80);
    }, 80);
  });

  // ===============================================================
  // SUITE 8: Advanced Parser Invariants & Specific Features
  // ===============================================================
  console.log(`\n▶ SUITE 8: Advanced Parser Invariants (CSV Multiline/Delimiter, XML CDATA/BadgerFish, TOML Inlines)`);
  {
    // 8.1 CSV Multiline Quoted Cells RFC 4180
    const multilineCsv = 'id,summary,status\n1,"First line\nSecond line\nThird line",Open\n2,"Single line",Closed';
    const csvParsed = csvParser.parse(multilineCsv);
    assert(csvParsed.success, 'CSV: Parses RFC 4180 multiline cells with internal newlines');
    assert(csvParsed.data.length === 2, 'CSV: Exactly 2 rows returned despite internal newlines');
    assert(csvParsed.data[0].summary === 'First line\nSecond line\nThird line', 'CSV: Preserves multiline string content verbatim');

    // 8.2 CSV Custom Semicolon & Pipe Delimiter
    const semiCsv = 'name;role;dept\nMinh;Admin;IT\nTriet;Dev;Engineering';
    const semiParsed = csvParser.parse(semiCsv);
    assert(semiParsed.success, 'CSV: Auto-detects semicolon delimiter');
    assert(semiParsed.data.length === 2 && semiParsed.data[0].dept === 'IT', 'CSV: Semicolon fields extracted properly');

    const pipeCsv = 'code|sku|quantity\nX1|ABC|50\nX2|DEF|100';
    const pipeParsed = csvParser.parse(pipeCsv);
    assert(pipeParsed.success, 'CSV: Auto-detects pipe delimiter');
    assert(pipeParsed.data.length === 2 && pipeParsed.data[1].quantity === 100, 'CSV: Pipe fields and numeric inference work');

    // 8.3 XML CDATA & Entity Preservation
    const xmlWithCdata = '<note id="101" type="memo">\n  <title>Meeting &amp; Notes</title>\n  <payload><![CDATA[<div>Custom <b>HTML</b> content & scripts</div>]]></payload>\n</note>';
    const xmlParsed = xmlParser.parse(xmlWithCdata);
    assert(xmlParsed.success, 'XML: Parses CDATA and entities');
    const note = xmlParsed.data.note;
    assert(note['@id'] === 101, 'XML BadgerFish: Preserves attribute @id with integer inference');
    assert(note['@type'] === 'memo', 'XML BadgerFish: Preserves attribute @type');
    assert(note.title === 'Meeting & Notes', 'XML: Decodes &amp; entity properly');
    assert(note.payload === '<div>Custom <b>HTML</b> content & scripts</div>', 'XML: Preserves CDATA raw payload with tags intact');

    // 8.4 TOML Inline Tables, Dotted Keys, Array of Tables
    const complexToml = `
[package]
name = "omnisync"
version = "1.0.0"

[dependencies]
config = { path = "../config", version = "2.0" }

[[bin]]
name = "omnisync-cli"
path = "bin/cli.js"

[[bin]]
name = "omnisync-srv"
path = "bin/server.js"
`;
    const tomlParsed = tomlParser.parse(complexToml);
    assert(tomlParsed.success, 'TOML: Parses inline tables and array of tables');
    assert(tomlParsed.data.dependencies.config.version === '2.0', 'TOML: Inline table parsed');
    assert(Array.isArray(tomlParsed.data.bin) && tomlParsed.data.bin.length === 2, 'TOML: Array of tables [[bin]] has 2 items');
    assert(tomlParsed.data.bin[1].name === 'omnisync-srv', 'TOML: Second bin entry has correct name');

    // 8.5 YAML Folded Block Scalar & Multiline Literal Block
    const yamlBlocks = `
title: "Block test"
literalBlock: |
  line 1
  line 2
foldedBlock: >
  this is a very long
  sentence that folds
`;
    const yamlParsed = yamlParser.parse(yamlBlocks);
    assert(yamlParsed.success, 'YAML: Parses block scalars');
    assert(yamlParsed.data.literalBlock === 'line 1\nline 2', 'YAML: Literal block (|) preserves newlines');
    assert(yamlParsed.data.foldedBlock.includes('sentence that folds'), 'YAML: Folded block (>) folds lines');
  }

  // ===============================================================
  // SUITE 9: Tree Diff & Schema Validator Engine
  // ===============================================================
  console.log(`\n▶ SUITE 9: Tree Diff & Schema Validator Engine (RFC 6902 Patches, Draft-07)`);
  {
    // 9.1 Diff & Patch generation
    const oldState = {
      title: 'Studio',
      count: 10,
      tags: ['alpha', 'beta'],
      user: { name: 'Triet', role: 'Dev' }
    };
    const newState = {
      title: 'OmniSync Studio', // modified
      tags: ['alpha', 'gamma'], // modified array
      user: { name: 'Triet', role: 'Architect' }, // modified nested
      status: 'active' // added
      // count removed
    };

    const diffResult = Diff.compare(oldState, newState);
    assert(Array.isArray(diffResult.patches), 'Diff: Returns RFC 6902 patches array');
    assert(diffResult.summary.includes('added') && diffResult.summary.includes('removed'), `Diff: Returns readable summary (${diffResult.summary})`);

    const ops = diffResult.patches.map(p => p.op);
    assert(ops.includes('replace'), 'Diff: Detects replace operation');
    assert(ops.includes('add'), 'Diff: Detects add operation');
    assert(ops.includes('remove'), 'Diff: Detects remove operation');

    // 9.2 Validator position mapping & code frame
    const sampleText = 'Line one\nLine two with error\nLine three';
    const coords = Validator.positionToCoordinates(sampleText, 14);
    assert(coords.line === 2 && coords.column === 6, 'Validator: Converts byte offset to line 2, col 6');

    const frame = Validator.generateCodeFrame(sampleText, 2, 6, 'Unexpected token');
    assert(frame.includes('> 2 | Line two with error') || frame.includes('>  2 | Line two with error'), 'Validator: Code frame highlights target line');
    assert(frame.includes('^ Unexpected token'), 'Validator: Code frame includes caret indicator');

    // 9.3 Schema validation (Draft-07)
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string', minLength: 2 },
        age: { type: 'number', minimum: 0 }
      }
    };
    const validData = { name: 'Nguyen Minh Triet', age: 18 };
    const invalidData = { name: 'N', age: -5 };

    const valResult1 = Validator.validateSchema(schema, validData);
    assert(valResult1.valid === true, 'Validator: Valid data passes schema validation');

    const valResult2 = Validator.validateSchema(schema, invalidData);
    assert(valResult2.valid === false, 'Validator: Invalid data fails schema validation');
    assert(valResult2.errors.length >= 2, 'Validator: Reports all validation violations');
  }

  // ===============================================================
  // SUMMARY
  // ===============================================================
  console.log(`\n===============================================================`);
  console.log(`  VERIFICATION RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log(`===============================================================`);

  if (failedTests > 0) {
    console.error(`\nFailures encountered:`);
    for (const f of failures) {
      console.error(`- ${f.message}`);
    }
    process.exit(1);
  } else {
    console.log(`\nAll empirical challenge tests completed successfully with 100% PASS!`);
    process.exit(0);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal unhandled error in test runner:', err);
  process.exit(1);
});

/**
 * OmniSync Data Studio - Universal Isomorphic Test Suites (Tiers 1 - 4)
 * RFC 8259, YAML 1.2, RFC 4180, W3C XML / BadgerFish, and TOML v1.0.0
 * Zero external dependencies. Executable in both Node.js CLI and Browser test harnesses.
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.TEST_SUITES = factory();
    root.TEST_SUITES = root.OmniSync.TEST_SUITES;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const suites = [];

  // =========================================================================
  // TIER 1: FEATURE COVERAGE (Isolated format features: JSON, YAML, CSV, XML, TOML)
  // =========================================================================

  // --- Suite 1.1: JSON Feature Coverage ---
  suites.push({
    name: 'Tier 1 - JSON Feature Coverage',
    tier: 1,
    format: 'json',
    tests: [
      {
        name: 'JSON: Primitive scalars (numbers, booleans, strings, null)',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const input = '{"intVal": 42, "floatVal": 3.14159, "boolTrue": true, "boolFalse": false, "strVal": "OmniSync", "nullVal": null}';
          const parseRes = json.parse(input);
          assert.ok(parseRes.success, 'JSON parse should succeed');
          assert.strictEqual(parseRes.data.intVal, 42);
          assert.strictEqual(parseRes.data.floatVal, 3.14159);
          assert.strictEqual(parseRes.data.boolTrue, true);
          assert.strictEqual(parseRes.data.boolFalse, false);
          assert.strictEqual(parseRes.data.strVal, 'OmniSync');
          assert.strictEqual(parseRes.data.nullVal, null);

          const serRes = json.stringify(parseRes.data);
          assert.ok(serRes.success, 'JSON stringify should succeed');
          const reparsed = json.parse(serRes.text);
          assert.ok(reparsed.success, 'Reparsing stringified JSON should succeed');
          assert.strictEqual(reparsed.data.intVal, 42);
        }
      },
      {
        name: 'JSON: Nested dictionaries and multidimensional arrays',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const input = JSON.stringify({
            server: {
              host: '127.0.0.1',
              ports: [80, 443, 8080],
              matrix: [[1, 2], [3, 4]]
            }
          });
          const parseRes = json.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.server.host, '127.0.0.1');
          assert.strictEqual(parseRes.data.server.ports.length, 3);
          assert.strictEqual(parseRes.data.server.ports[2], 8080);
          assert.strictEqual(parseRes.data.server.matrix[1][0], 3);
        }
      },
      {
        name: 'JSON: Formatting and indentation options (compact, 2-space, tab)',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const data = { a: 1, b: [2, 3] };

          const compact = json.stringify(data, { indent: 'compact' });
          assert.ok(compact.success);
          assert.ok(!compact.text.includes('\n'), 'Compact JSON should not contain newlines');

          const indent2 = json.stringify(data, { indent: 2 });
          assert.ok(indent2.success);
          assert.ok(indent2.text.includes('  "a": 1'), 'Should indent with 2 spaces');

          const indentTab = json.stringify(data, { indent: 'tab' });
          assert.ok(indentTab.success);
          assert.ok(indentTab.text.includes('\t"a": 1'), 'Should indent with tab');
        }
      },
      {
        name: 'JSON: Circular reference protection during serialization',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const circularObj = { name: 'root' };
          circularObj.self = circularObj;

          const res = json.stringify(circularObj);
          assert.strictEqual(res.success, false, 'Circular references must return success: false');
          assert.ok(res.error, 'Error object should be present');
          assert.ok(res.error.message.includes('Circular reference'), 'Should state circular reference detected');
        }
      },
      {
        name: 'JSON: BigInt serialization and preservation',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const data = { big: typeof BigInt !== 'undefined' ? BigInt(9007199254740991) : 9007199254740991 };
          const res = json.stringify(data);
          assert.ok(res.success);
          assert.ok(res.text.includes('9007199254740991'), 'BigInt value should be stringified safely');
        }
      },
      {
        name: 'JSON: Array of complex objects preservation',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const raw = '[{"id": 1, "name": "Item A"}, {"id": 2, "name": "Item B"}]';
          const parseRes = json.parse(raw);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.length, 2);
          assert.strictEqual(parseRes.data[1].name, 'Item B');
        }
      }
    ]
  });

  // --- Suite 1.2: YAML Feature Coverage ---
  suites.push({
    name: 'Tier 1 - YAML Feature Coverage',
    tier: 1,
    format: 'yaml',
    tests: [
      {
        name: 'YAML: Primitive scalar types (integers, floats, booleans, strings)',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = 'integer: 100\nfloatVal: 99.95\nboolVal: true\nstrVal: OmniSync Studio';
          const parseRes = yaml.parse(input);
          assert.ok(parseRes.success, 'YAML parse should succeed');
          assert.strictEqual(parseRes.data.integer, 100);
          assert.strictEqual(parseRes.data.floatVal, 99.95);
          assert.strictEqual(parseRes.data.boolVal, true);
          assert.strictEqual(parseRes.data.strVal, 'OmniSync Studio');

          const serRes = yaml.stringify(parseRes.data);
          assert.ok(serRes.success);
          assert.ok(serRes.text.includes('integer: 100'));
        }
      },
      {
        name: 'YAML: Key-value mappings and nested hierarchies',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = 'app:\n  title: DataStudio\n  settings:\n    theme: dark\n    port: 3000';
          const parseRes = yaml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.app.title, 'DataStudio');
          assert.strictEqual(parseRes.data.app.settings.theme, 'dark');
          assert.strictEqual(parseRes.data.app.settings.port, 3000);
        }
      },
      {
        name: 'YAML: Bulleted sequences and list of objects',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = 'fruits:\n  - Apple\n  - Banana\n  - Orange\nusers:\n  - name: Alice\n    id: 1\n  - name: Bob\n    id: 2';
          const parseRes = yaml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.fruits.length, 3);
          assert.strictEqual(parseRes.data.fruits[1], 'Banana');
          assert.strictEqual(parseRes.data.users[0].name, 'Alice');
          assert.strictEqual(parseRes.data.users[1].id, 2);
        }
      },
      {
        name: 'YAML: Comment stripping (full line & inline comments)',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = '# Top level comment\nname: Project # Inline comment\n# Middle comment\nversion: 1.0';
          const parseRes = yaml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.name, 'Project');
          assert.strictEqual(parseRes.data.version, 1.0);
        }
      },
      {
        name: 'YAML: Multiline literal block scalar (|) preserving newlines',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = 'description: |\n  Line 1\n  Line 2\n  Line 3';
          const parseRes = yaml.parse(input);
          assert.ok(parseRes.success);
          assert.ok(parseRes.data.description.includes('Line 1\nLine 2\nLine 3'));
        }
      },
      {
        name: 'YAML: Quoted keys containing colons and special characters',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = '"http://localhost:8080": "endpoint"\n\'prefix:key\': 456';
          const parseRes = yaml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data['http://localhost:8080'], 'endpoint');
          assert.strictEqual(parseRes.data['prefix:key'], 456);
        }
      }
    ]
  });

  // --- Suite 1.3: CSV Feature Coverage ---
  suites.push({
    name: 'Tier 1 - CSV Feature Coverage',
    tier: 1,
    format: 'csv',
    tests: [
      {
        name: 'CSV: Standard RFC 4180 records with header and rows',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const input = 'id,name,role\n1,Minh Triet,Lead\n2,Alice,Developer';
          const parseRes = csv.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.length, 2);
          assert.strictEqual(parseRes.data[0].id, 1);
          assert.strictEqual(parseRes.data[0].name, 'Minh Triet');
          assert.strictEqual(parseRes.data[1].role, 'Developer');
        }
      },
      {
        name: 'CSV: Quoted fields containing commas and escaped quotes ("")',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const input = 'id,address,quote\n101,"Cai Nuoc, Ca Mau","He said ""Hello!"""';
          const parseRes = csv.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data[0].address, 'Cai Nuoc, Ca Mau');
          assert.strictEqual(parseRes.data[0].quote, 'He said "Hello!"');
        }
      },
      {
        name: 'CSV: Auto-delimiter detection (semicolon, tab, pipe)',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;

          const semi = 'id;name;score\n1;Triet;9.8\n2;Bao;9.0';
          const resSemi = csv.parse(semi);
          assert.ok(resSemi.success);
          assert.strictEqual(resSemi.data[0].name, 'Triet');

          const tab = 'colA\tcolB\tcolC\n10\t20\t30';
          const resTab = csv.parse(tab);
          assert.ok(resTab.success);
          assert.strictEqual(resTab.data[0].colB, 20);

          const pipe = 'user|role|active\nadmin|superuser|true';
          const resPipe = csv.parse(pipe);
          assert.ok(resPipe.success);
          assert.strictEqual(resPipe.data[0].role, 'superuser');
          assert.strictEqual(resPipe.data[0].active, true);
        }
      },
      {
        name: 'CSV: Dot-notation unflattening to hierarchical objects',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const input = 'id,student.name,student.address.city\n1,Nguyen Minh Triet,Ca Mau';
          const parseRes = csv.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data[0].student.name, 'Nguyen Minh Triet');
          assert.strictEqual(parseRes.data[0].student.address.city, 'Ca Mau');
        }
      },
      {
        name: 'CSV: Nested object serialization with dot-notation flattening',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const data = [
            { id: 1, user: { profile: { name: 'Triet', dept: 'EE' } } }
          ];
          const serRes = csv.stringify(data);
          assert.ok(serRes.success);
          assert.ok(serRes.text.includes('user.profile.name'));
          assert.ok(serRes.text.includes('user.profile.dept'));
        }
      },
      {
        name: 'CSV: Heterogeneous superset headers across multiple records',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const data = [
            { a: 1, b: 2 },
            { b: 20, c: 30 }
          ];
          const serRes = csv.stringify(data);
          assert.ok(serRes.success);
          const firstLine = serRes.text.split(/\r?\n/)[0];
          assert.ok(firstLine.includes('a'));
          assert.ok(firstLine.includes('b'));
          assert.ok(firstLine.includes('c'));
        }
      }
    ]
  });

  // --- Suite 1.4: XML Feature Coverage ---
  suites.push({
    name: 'Tier 1 - XML Feature Coverage',
    tier: 1,
    format: 'xml',
    tests: [
      {
        name: 'XML: BadgerFish IR mapping for elements and attributes (@)',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<student id="2610525" status="active"><name>Nguyen Minh Triet</name></student>';
          const parseRes = xml.parse(input);
          assert.ok(parseRes.success);
          assert.ok(parseRes.data.student);
          assert.strictEqual(parseRes.data.student['@id'], 2610525);
          assert.strictEqual(parseRes.data.student['@status'], 'active');
          assert.strictEqual(parseRes.data.student.name, 'Nguyen Minh Triet');
        }
      },
      {
        name: 'XML: Text nodes and element values (#text)',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<item code="A1">Premium Widget</item>';
          const parseRes = xml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.item['@code'], 'A1');
          assert.strictEqual(parseRes.data.item['#text'], 'Premium Widget');
        }
      },
      {
        name: 'XML: CDATA section preservation and unescaped payload',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<data><script><![CDATA[if (a < b && c > d) { return "ok"; }]]></script></data>';
          const parseRes = xml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.data.script, 'if (a < b && c > d) { return "ok"; }');
        }
      },
      {
        name: 'XML: Synthetic root wrapping on multi-key serialization',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const data = { alpha: 1, beta: 2 };
          const serRes = xml.stringify(data);
          assert.ok(serRes.success);
          assert.ok(serRes.text.includes('<root>'), 'Must contain synthetic <root> element');
          assert.ok(serRes.text.includes('<alpha>1</alpha>'));
          assert.ok(serRes.text.includes('<beta>2</beta>'));
          assert.ok(serRes.text.includes('</root>'), 'Must contain closing </root> element');
        }
      },
      {
        name: 'XML: Entity decoding (&amp;, &lt;, &gt;, &quot;, &apos;)',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<doc><message>Tom &amp; Jerry &lt;show&gt; &quot;2026&quot;</message></doc>';
          const parseRes = xml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.doc.message, 'Tom & Jerry <show> "2026"');
        }
      },
      {
        name: 'XML: Repeated sibling tags as array',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<catalog><book id="1"><title>Book A</title></book><book id="2"><title>Book B</title></book></catalog>';
          const parseRes = xml.parse(input);
          assert.ok(parseRes.success);
          assert.ok(Array.isArray(parseRes.data.catalog.book));
          assert.strictEqual(parseRes.data.catalog.book.length, 2);
          assert.strictEqual(parseRes.data.catalog.book[0].title, 'Book A');
        }
      }
    ]
  });

  // --- Suite 1.5: TOML Feature Coverage ---
  suites.push({
    name: 'Tier 1 - TOML Feature Coverage',
    tier: 1,
    format: 'toml',
    tests: [
      {
        name: 'TOML: Typed key-value primitives (integers, floats, booleans, strings)',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const input = 'title = "OmniSync"\nport = 8080\npi = 3.14159\nenabled = true';
          const parseRes = toml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.title, 'OmniSync');
          assert.strictEqual(parseRes.data.port, 8080);
          assert.strictEqual(parseRes.data.pi, 3.14159);
          assert.strictEqual(parseRes.data.enabled, true);
        }
      },
      {
        name: 'TOML: Standard tables [server] and nested tables [server.db]',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const input = '[server]\nhost = "localhost"\n[server.db]\nname = "testdb"\npool = 10';
          const parseRes = toml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.server.host, 'localhost');
          assert.strictEqual(parseRes.data.server.db.name, 'testdb');
          assert.strictEqual(parseRes.data.server.db.pool, 10);
        }
      },
      {
        name: 'TOML: Dotted keys notation (site.meta.version)',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const input = 'site.meta.version = "1.0.0"\nsite.meta.author = "Minh Triet"';
          const parseRes = toml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.site.meta.version, '1.0.0');
          assert.strictEqual(parseRes.data.site.meta.author, 'Minh Triet');
        }
      },
      {
        name: 'TOML: Array of tables [[products]]',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const input = '[[products]]\nname = "Laptop"\nprice = 1200\n[[products]]\nname = "Mouse"\nprice = 25';
          const parseRes = toml.parse(input);
          assert.ok(parseRes.success);
          assert.ok(Array.isArray(parseRes.data.products));
          assert.strictEqual(parseRes.data.products.length, 2);
          assert.strictEqual(parseRes.data.products[0].name, 'Laptop');
          assert.strictEqual(parseRes.data.products[1].price, 25);
        }
      },
      {
        name: 'TOML: Inline tables { x = 1, y = 2 }',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const input = 'point = { x = 10, y = 20, label = "Origin" }';
          const parseRes = toml.parse(input);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.point.x, 10);
          assert.strictEqual(parseRes.data.point.y, 20);
          assert.strictEqual(parseRes.data.point.label, 'Origin');
        }
      },
      {
        name: 'TOML: Multiline strings (""") preserving line breaks',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const input = 'bio = """\nStudent at HCMUT\nDepartment of EE\nYear 2026"""';
          const parseRes = toml.parse(input);
          assert.ok(parseRes.success);
          assert.ok(parseRes.data.bio.includes('Student at HCMUT'));
          assert.ok(parseRes.data.bio.includes('Year 2026'));
        }
      }
    ]
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (Pathological, Unicode, Error coordinates)
  // =========================================================================

  // --- Suite 2.1: JSON Boundary & Edge Cases ---
  suites.push({
    name: 'Tier 2 - JSON Boundary & Edge Cases',
    tier: 2,
    format: 'json',
    tests: [
      {
        name: 'JSON Boundary: Empty string and whitespace-only documents',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const empty = json.parse('');
          assert.ok(empty.success);
          assert.deepStrictEqual(empty.data, {});

          const ws = json.parse('   \n\t  ');
          assert.ok(ws.success);
          assert.deepStrictEqual(ws.data, {});
        }
      },
      {
        name: 'JSON Boundary: Zero, negative numbers, and high precision floats',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const input = '{"zero": 0, "negZero": -0, "negInt": -999, "smallFloat": 0.0000000123}';
          const res = json.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.zero, 0);
          assert.strictEqual(res.data.negInt, -999);
          assert.strictEqual(res.data.smallFloat, 0.0000000123);
        }
      },
      {
        name: 'JSON Boundary: Vietnamese Unicode diacritics & UTF-8 symbols',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const data = {
            author: 'Nguyễn Minh Triết',
            hometown: 'Cái Nước, Cà Mau',
            university: 'Trường Đại học Bách Khoa TP.HCM (HCMUT)',
            faculty: 'Khoa Điện - Điện tử',
            symbols: '⚡ 🔬 🎓 ✨',
            vietnameseAlphabet: 'a ă â e ê o ô ơ u ư đ'
          };
          const serRes = json.stringify(data);
          assert.ok(serRes.success);
          const parseRes = json.parse(serRes.text);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.author, 'Nguyễn Minh Triết');
          assert.strictEqual(parseRes.data.hometown, 'Cái Nước, Cà Mau');
          assert.strictEqual(parseRes.data.faculty, 'Khoa Điện - Điện tử');
          assert.strictEqual(parseRes.data.symbols, '⚡ 🔬 🎓 ✨');
        }
      },
      {
        name: 'JSON Boundary: Unclosed brace error pinpointing line, column and caret',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const badInput = '{\n  "name": "test",\n  "broken": [1, 2';
          const res = json.parse(badInput);
          assert.strictEqual(res.success, false);
          assert.ok(res.error, 'Error object should be populated');
          assert.ok(res.error.line >= 1, 'Error line must be >= 1');
          assert.ok(res.error.column >= 1, 'Error col must be >= 1');
          assert.ok(res.error.snippet.includes('^'), 'Snippet must include caret indicator');
        }
      },
      {
        name: 'JSON Boundary: Escaped quotes, backslashes, and control characters',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const input = '{"escaped": "Line1\\nLine2\\tTabbed \\"Quotes\\" and \\\\backslash"}';
          const res = json.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.escaped, 'Line1\nLine2\tTabbed "Quotes" and \\backslash');
        }
      },
      {
        name: 'JSON Boundary: Extreme 12-level deep nesting hierarchy',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          let obj = { val: 'deep' };
          for (let i = 0; i < 12; i++) {
            obj = { nest: obj };
          }
          const serRes = json.stringify(obj);
          assert.ok(serRes.success);
          const parseRes = json.parse(serRes.text);
          assert.ok(parseRes.success);
          assert.ok(engine.IR.deepEquals(parseRes.data, obj), 'Deep nesting must be preserved 100%');
        }
      }
    ]
  });

  // --- Suite 2.2: YAML Boundary & Edge Cases ---
  suites.push({
    name: 'Tier 2 - YAML Boundary & Edge Cases',
    tier: 2,
    format: 'yaml',
    tests: [
      {
        name: 'YAML Boundary: Empty string and whitespace-only documents',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const empty = yaml.parse('');
          assert.ok(empty.success);
          assert.deepStrictEqual(empty.data, {});

          const ws = yaml.parse('   \n  \n');
          assert.ok(ws.success);
          assert.deepStrictEqual(ws.data, {});
        }
      },
      {
        name: 'YAML Boundary: "The Norway Problem" string protection',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          // Values like NO, yes, true, false when quoted must stay strings
          const input = 'countryCode: "NO"\nstatus: "yes"\nflag: "true"';
          const res = yaml.parse(input);
          assert.ok(res.success);
          assert.strictEqual(typeof res.data.countryCode, 'string');
          assert.strictEqual(res.data.countryCode, 'NO');
          assert.strictEqual(typeof res.data.status, 'string');
          assert.strictEqual(res.data.status, 'yes');
          assert.strictEqual(typeof res.data.flag, 'string');
          assert.strictEqual(res.data.flag, 'true');
        }
      },
      {
        name: 'YAML Boundary: Tab indentation rejection with line/col diagnostics',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = 'root:\n\tinvalidTabKey: 123';
          const res = yaml.parse(input);
          assert.strictEqual(res.success, false);
          assert.ok(res.error);
          assert.strictEqual(res.error.line, 2);
          assert.strictEqual(res.error.column, 1);
          assert.ok(res.error.message.toLowerCase().includes('tab'));
        }
      },
      {
        name: 'YAML Boundary: Non-string and null input validation error reporting',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const res = yaml.parse(null);
          assert.strictEqual(res.success, false);
          assert.ok(res.error);
          assert.strictEqual(res.error.line, 1);
          assert.strictEqual(res.error.column, 1);
          assert.ok(res.error.message.includes('valid string'));
        }
      },
      {
        name: 'YAML Boundary: Folded block scalar (>) unfolding lines',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = 'notes: >\n  This is a folded\n  sentence that joins\n  into one string';
          const res = yaml.parse(input);
          assert.ok(res.success);
          assert.ok(res.data.notes.includes('This is a folded sentence'));
        }
      },
      {
        name: 'YAML Boundary: Null and tilde values mapped cleanly to null',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const input = 'valA: null\nvalB: ~\nvalC: ';
          const res = yaml.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.valA, null);
          assert.strictEqual(res.data.valB, null);
          assert.strictEqual(res.data.valC, null);
        }
      }
    ]
  });

  // --- Suite 2.3: CSV Boundary & Edge Cases ---
  suites.push({
    name: 'Tier 2 - CSV Boundary & Edge Cases',
    tier: 2,
    format: 'csv',
    tests: [
      {
        name: 'CSV Boundary: Empty input and whitespace-only documents',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const res = csv.parse('');
          assert.ok(res.success);
          assert.deepStrictEqual(res.data, []);

          const resWs = csv.parse('   \n  \n');
          assert.ok(resWs.success);
          assert.deepStrictEqual(resWs.data, []);
        }
      },
      {
        name: 'CSV Boundary: UTF-8 Byte Order Mark (BOM) stripping',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const bomInput = '\uFEFFname,score\nMinh Triet,10';
          const res = csv.parse(bomInput);
          assert.ok(res.success);
          assert.ok(res.data[0].name !== undefined, 'First header should not have BOM attached');
          assert.strictEqual(res.data[0].name, 'Minh Triet');
        }
      },
      {
        name: 'CSV Boundary: Multiline cell with internal newlines inside quotes',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const input = 'id,remarks\n1,"Line 1\nLine 2\nLine 3"\n2,"Simple"';
          const res = csv.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.length, 2);
          assert.strictEqual(res.data[0].remarks, 'Line 1\nLine 2\nLine 3');
          assert.strictEqual(res.data[1].remarks, 'Simple');
        }
      },
      {
        name: 'CSV Boundary: Unclosed quote error locator with line/col coordinates',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const badInput = 'id,name\n1,"Unclosed quote here\n2,Bob';
          const res = csv.parse(badInput);
          assert.strictEqual(res.success, false);
          assert.ok(res.error);
          assert.strictEqual(res.error.line, 2);
          assert.strictEqual(res.error.column, 3);
          assert.ok(res.error.snippet.includes('^'));
        }
      },
      {
        name: 'CSV Boundary: Ragged rows with missing or trailing empty columns',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const input = 'colA,colB,colC\n1,2\n3,4,5,6\n7,8,9';
          const res = csv.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.length, 3);
          assert.strictEqual(res.data[0].colA, 1);
          assert.strictEqual(res.data[0].colB, 2);
          assert.strictEqual(res.data[0].colC, null);
        }
      },
      {
        name: 'CSV Boundary: Single record object serialization without array wrapper',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const singleObj = { id: 42, role: 'Admin' };
          const serRes = csv.stringify(singleObj);
          assert.ok(serRes.success);
          assert.ok(serRes.text.includes('id,role'));
          assert.ok(serRes.text.includes('42,Admin'));
        }
      }
    ]
  });

  // --- Suite 2.4: XML Boundary & Edge Cases ---
  suites.push({
    name: 'Tier 2 - XML Boundary & Edge Cases',
    tier: 2,
    format: 'xml',
    tests: [
      {
        name: 'XML Boundary: Empty string and whitespace-only documents',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const empty = xml.parse('');
          assert.ok(empty.success);
          assert.deepStrictEqual(empty.data, {});

          const ws = xml.parse('   \n\t  ');
          assert.ok(ws.success);
          assert.deepStrictEqual(ws.data, {});
        }
      },
      {
        name: 'XML Boundary: Mismatched closing tag diagnostic locator',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<root>\n  <item>Hello\n</wrong>\n</root>';
          const res = xml.parse(input);
          assert.strictEqual(res.success, false);
          assert.ok(res.error);
          assert.strictEqual(res.error.line, 3);
          assert.ok(res.error.message.includes('Mismatched') || res.error.message.includes('wrong'));
        }
      },
      {
        name: 'XML Boundary: Unclosed tag detection',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<root>\n  <unclosed>Data';
          const res = xml.parse(input);
          assert.strictEqual(res.success, false);
          assert.ok(res.error);
          assert.ok(res.error.line >= 1);
        }
      },
      {
        name: 'XML Boundary: Self-closing empty tags (<item attr="val" />)',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<catalog><item id="100" available="true" /></catalog>';
          const res = xml.parse(input);
          assert.ok(res.success);
          assert.ok(res.data.catalog.item);
          assert.strictEqual(res.data.catalog.item['@id'], 100);
          assert.strictEqual(res.data.catalog.item['@available'], true);
        }
      },
      {
        name: 'XML Boundary: Special characters escaping inside attributes',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<element title="A &amp; B &lt;C&gt; &quot;D&quot;" />';
          const res = xml.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.element['@title'], 'A & B <C> "D"');
        }
      },
      {
        name: 'XML Boundary: XML prologue declaration and multiline comments',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const input = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Multi-line\ncomment block -->\n<root><val>42</val></root>';
          const res = xml.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.root.val, 42);
        }
      }
    ]
  });

  // --- Suite 2.5: TOML Boundary & Edge Cases ---
  suites.push({
    name: 'Tier 2 - TOML Boundary & Edge Cases',
    tier: 2,
    format: 'toml',
    tests: [
      {
        name: 'TOML Boundary: Empty string and whitespace-only documents',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const empty = toml.parse('');
          assert.ok(empty.success);
          assert.deepStrictEqual(empty.data, {});

          const ws = toml.parse('   \n  \n');
          assert.ok(ws.success);
          assert.deepStrictEqual(ws.data, {});
        }
      },
      {
        name: 'TOML Boundary: Negative floats, scientific notation, and zeroes',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const input = 'zero = 0\nnegZero = -0.0\nnegFloat = -123.456\nsci = 1.2e-4';
          const res = toml.parse(input);
          assert.ok(res.success);
          assert.strictEqual(res.data.zero, 0);
          assert.strictEqual(res.data.negFloat, -123.456);
          assert.strictEqual(res.data.sci, 0.00012);
        }
      },
      {
        name: 'TOML Boundary: Missing equals syntax error with line/col diagnostics',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const badInput = '[config]\nvalid = 1\nmissingEqualsValue\nnext = 2';
          const res = toml.parse(badInput);
          assert.strictEqual(res.success, false);
          assert.ok(res.error);
          assert.strictEqual(res.error.line, 3);
          assert.ok(res.error.snippet.includes('^'));
        }
      },
      {
        name: 'TOML Boundary: Unclosed string error reporting',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const badInput = 'key = "unclosed string literal\nother = 2';
          const res = toml.parse(badInput);
          assert.strictEqual(res.success, false);
          assert.ok(res.error);
          assert.strictEqual(res.error.line, 1);
        }
      },
      {
        name: 'TOML Boundary: Serialization table ordering invariant (primitives before tables)',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const data = {
            subTable: { key: 'inside table' },
            rootPrimitiveA: 'should appear before subTable',
            rootPrimitiveB: 99
          };
          const serRes = toml.stringify(data);
          assert.ok(serRes.success);
          const tableIdx = serRes.text.indexOf('[subTable]');
          const primIdx = serRes.text.indexOf('rootPrimitiveA');
          assert.ok(primIdx < tableIdx, 'Root primitive keys must precede [subTable] headers per TOML specification');
        }
      },
      {
        name: 'TOML Boundary: Unicode diacritics and special characters in strings',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const data = {
            name: 'Nguyễn Minh Triết',
            dept: 'Khoa Điện - Điện tử',
            school: 'Trường Đại học Bách Khoa TP.HCM'
          };
          const serRes = toml.stringify(data);
          assert.ok(serRes.success);
          const parseRes = toml.parse(serRes.text);
          assert.ok(parseRes.success);
          assert.strictEqual(parseRes.data.name, 'Nguyễn Minh Triết');
          assert.strictEqual(parseRes.data.dept, 'Khoa Điện - Điện tử');
        }
      }
    ]
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Round-Trip & Propagation)
  // =========================================================================

  suites.push({
    name: 'Tier 3 - Pairwise Format Round-Trip Fidelity',
    tier: 3,
    tests: [
      {
        name: 'Round-Trip: JSON <-> YAML bidirectional semantic equivalence',
        run: function (assert, engine) {
          const json = engine.parsers.json;
          const yaml = engine.parsers.yaml;
          const original = {
            project: 'OmniSync Studio',
            version: 1.0,
            active: true,
            tags: ['converter', 'synchronizer', 'workbench'],
            config: {
              timeout: 5000,
              retries: 3
            }
          };

          const toYaml = yaml.stringify(original);
          assert.ok(toYaml.success);

          const fromYaml = yaml.parse(toYaml.text);
          assert.ok(fromYaml.success);

          const backToJson = json.stringify(fromYaml.data);
          assert.ok(backToJson.success);

          const finalObj = json.parse(backToJson.text);
          assert.ok(finalObj.success);

          assert.ok(engine.IR.deepEquals(original, finalObj.data), 'JSON <-> YAML must maintain 100% semantic equivalence');
        }
      },
      {
        name: 'Round-Trip: JSON <-> CSV hierarchical flattening & reconstruction',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const original = [
            {
              id: 1,
              user: { name: 'Nguyen Minh Triet', email: 'triet@hcmut.edu.vn' },
              stats: { score: 9.8, rank: 1 }
            },
            {
              id: 2,
              user: { name: 'Alice Smith', email: 'alice@example.com' },
              stats: { score: 9.2, rank: 2 }
            }
          ];

          const toCsv = csv.stringify(original);
          assert.ok(toCsv.success);
          assert.ok(toCsv.text.includes('user.name'));
          assert.ok(toCsv.text.includes('stats.score'));

          const fromCsv = csv.parse(toCsv.text);
          assert.ok(fromCsv.success);
          assert.strictEqual(fromCsv.data.length, 2);
          assert.strictEqual(fromCsv.data[0].user.name, 'Nguyen Minh Triet');
          assert.strictEqual(fromCsv.data[0].stats.score, 9.8);
          assert.ok(engine.IR.deepEquals(original, fromCsv.data));
        }
      },
      {
        name: 'Round-Trip: JSON <-> XML BadgerFish IR preservation',
        run: function (assert, engine) {
          const xml = engine.parsers.xml;
          const original = {
            university: {
              '@code': 'HCMUT',
              name: 'Bach Khoa TP.HCM',
              faculty: {
                '@id': 'EE',
                title: 'Dien - Dien tu'
              }
            }
          };

          const toXml = xml.stringify(original);
          assert.ok(toXml.success);
          assert.ok(toXml.text.includes('code="HCMUT"'));

          const fromXml = xml.parse(toXml.text);
          assert.ok(fromXml.success);
          assert.strictEqual(fromXml.data.university['@code'], 'HCMUT');
          assert.strictEqual(fromXml.data.university.name, 'Bach Khoa TP.HCM');
          assert.strictEqual(fromXml.data.university.faculty['@id'], 'EE');
        }
      },
      {
        name: 'Round-Trip: JSON <-> TOML configuration tables preservation',
        run: function (assert, engine) {
          const toml = engine.parsers.toml;
          const original = {
            appName: 'OmniSync',
            port: 8080,
            features: {
              bidirectional: true,
              autoDetect: true
            },
            endpoints: [
              { path: '/api/v1', enabled: true },
              { path: '/api/v2', enabled: false }
            ]
          };

          const toToml = toml.stringify(original);
          assert.ok(toToml.success);

          const fromToml = toml.parse(toToml.text);
          assert.ok(fromToml.success);
          assert.ok(engine.IR.deepEquals(original, fromToml.data), 'JSON <-> TOML must preserve nested tables and array of tables');
        }
      },
      {
        name: 'Round-Trip: YAML <-> TOML configuration cross-translation',
        run: function (assert, engine) {
          const yaml = engine.parsers.yaml;
          const toml = engine.parsers.toml;
          const yamlConfig = 'server:\n  host: 0.0.0.0\n  port: 9000\ndatabase:\n  engine: postgresql\n  pool: 15';

          const parsedYaml = yaml.parse(yamlConfig);
          assert.ok(parsedYaml.success);

          const toToml = toml.stringify(parsedYaml.data);
          assert.ok(toToml.success);

          const parsedToml = toml.parse(toToml.text);
          assert.ok(parsedToml.success);

          assert.strictEqual(parsedToml.data.server.port, 9000);
          assert.strictEqual(parsedToml.data.database.engine, 'postgresql');
        }
      },
      {
        name: 'Round-Trip: CSV <-> XML tabular records to structured XML rows',
        run: function (assert, engine) {
          const csv = engine.parsers.csv;
          const xml = engine.parsers.xml;
          const csvText = 'id,product,price\n101,Microcontroller,15.5\n102,Sensor,8.2';

          const parsedCsv = csv.parse(csvText);
          assert.ok(parsedCsv.success);

          // Wrap records in XML root
          const toXml = xml.stringify({ records: { record: parsedCsv.data } });
          assert.ok(toXml.success);
          assert.ok(toXml.text.includes('<record>'));

          const parsedXml = xml.parse(toXml.text);
          assert.ok(parsedXml.success);
          assert.strictEqual(parsedXml.data.records.record.length, 2);
          assert.strictEqual(parsedXml.data.records.record[0].product, 'Microcontroller');
        }
      },
      {
        name: 'Round-Trip: 5-Format Transitive Cyclic Chain (JSON -> YAML -> TOML -> XML -> JSON)',
        run: function (assert, engine) {
          const initial = {
            doc: {
              title: 'Cyclic Transitivity',
              count: 42,
              active: true
            }
          };

          // Step 1: JSON -> YAML
          const yamlText = engine.parsers.yaml.stringify(initial).text;
          const yamlObj = engine.parsers.yaml.parse(yamlText).data;

          // Step 2: YAML -> TOML
          const tomlText = engine.parsers.toml.stringify(yamlObj).text;
          const tomlObj = engine.parsers.toml.parse(tomlText).data;

          // Step 3: TOML -> XML
          const xmlText = engine.parsers.xml.stringify(tomlObj).text;
          const xmlObj = engine.parsers.xml.parse(xmlText).data;

          // Step 4: XML -> JSON
          const jsonText = engine.parsers.json.stringify(xmlObj).text;
          const finalObj = engine.parsers.json.parse(jsonText).data;

          assert.strictEqual(finalObj.doc.title, 'Cyclic Transitivity');
          assert.strictEqual(finalObj.doc.count, 42);
          assert.strictEqual(finalObj.doc.active, true);
        }
      },
      {
        name: 'SyncEngine: Left-to-Right and Right-to-Left bidirectional conversion parity',
        run: function (assert, engine) {
          const sync = new engine.SyncEngine();
          const jsonSample = '{"user": "Triet", "score": 100}';

          // Convert Left -> Right (JSON -> YAML)
          const l2r = sync.convertImmediate(jsonSample, 'json', 'yaml');
          assert.ok(l2r.success);
          assert.ok(l2r.result.includes('user: Triet'));

          // Convert Right -> Left (YAML -> JSON)
          const r2l = sync.convertImmediate(l2r.result, 'yaml', 'json');
          assert.ok(r2l.success);
          const backObj = JSON.parse(r2l.result);
          assert.strictEqual(backObj.user, 'Triet');
          assert.strictEqual(backObj.score, 100);
        }
      }
    ]
  });

  // =========================================================================
  // TIER 4: REAL-WORLD APPLICATION WORKLOADS (Realistic Production Scenarios)
  // =========================================================================

  suites.push({
    name: 'Tier 4 - Real-World Application Workloads',
    tier: 4,
    tests: [
      {
        name: 'Workload 1: Microservices REST API Response (Users, Roles, Permissions)',
        run: function (assert, engine) {
          const sync = new engine.SyncEngine();
          const apiPayload = {
            status: 'success',
            code: 200,
            meta: {
              requestId: 'req_b8f419d2',
              timestamp: '2026-11-05T08:30:00Z',
              pagination: {
                page: 1,
                limit: 10,
                total: 85,
                totalPages: 9
              }
            },
            data: {
              users: [
                {
                  id: 'usr_2610525',
                  username: 'triet.nguyen',
                  email: 'triet.nguyen@hcmut.edu.vn',
                  fullName: 'Nguyễn Minh Triết',
                  department: 'Khoa Điện - Điện tử',
                  cohort: 2026,
                  roles: ['student', 'researcher'],
                  permissions: ['lab.access', 'compute.run', 'library.read'],
                  active: true
                },
                {
                  id: 'usr_990142',
                  username: 'supervisor.ee',
                  email: 'ee.advisor@hcmut.edu.vn',
                  fullName: 'TS. Nguyễn Văn A',
                  department: 'Khoa Điện - Điện tử',
                  cohort: 2010,
                  roles: ['lecturer', 'advisor'],
                  permissions: ['all.manage'],
                  active: true
                }
              ]
            }
          };

          const jsonText = JSON.stringify(apiPayload, null, 2);

          // Convert JSON -> YAML
          const toYaml = sync.convertImmediate(jsonText, 'json', 'yaml');
          assert.ok(toYaml.success, 'REST API payload should convert cleanly to YAML');
          assert.ok(toYaml.result.includes('triet.nguyen@hcmut.edu.vn'));
          assert.ok(toYaml.result.includes('Khoa Điện - Điện tử'));

          // Convert YAML -> TOML
          const toToml = sync.convertImmediate(toYaml.result, 'yaml', 'toml');
          assert.ok(toToml.success, 'YAML should convert cleanly to TOML');
          assert.ok(toToml.result.includes('req_b8f419d2'));

          // Convert TOML back to JSON and verify full structural fidelity
          const backToJson = sync.convertImmediate(toToml.result, 'toml', 'json');
          assert.ok(backToJson.success);
          const parsed = JSON.parse(backToJson.result);
          assert.strictEqual(parsed.code, 200);
          assert.strictEqual(parsed.meta.pagination.totalPages, 9);
          assert.strictEqual(parsed.data.users[0].fullName, 'Nguyễn Minh Triết');
          assert.deepStrictEqual(parsed.data.users[0].permissions, ['lab.access', 'compute.run', 'library.read']);
        }
      },
      {
        name: 'Workload 2: IoT Sensor Time-Series Telemetry (Float metrics & Geo-coordinates)',
        run: function (assert, engine) {
          const sync = new engine.SyncEngine();
          const telemetryRecords = [
            {
              device_id: 'IOT-HCMUT-01',
              timestamp: '2026-11-05T08:00:00Z',
              geo: { latitude: 10.7725, longitude: 106.6578, altitude_m: 14.5 },
              metrics: { temperature: 29.4, humidity: 78.2, pressure: 1012.8, battery: 3.85 },
              alert: false
            },
            {
              device_id: 'IOT-HCMUT-02',
              timestamp: '2026-11-05T08:01:00Z',
              geo: { latitude: 10.7730, longitude: 106.6585, altitude_m: 15.0 },
              metrics: { temperature: 30.1, humidity: 76.5, pressure: 1012.5, battery: 3.82 },
              alert: false
            },
            {
              device_id: 'IOT-HCMUT-03',
              timestamp: '2026-11-05T08:02:00Z',
              geo: { latitude: 10.7718, longitude: 106.6570, altitude_m: 14.0 },
              metrics: { temperature: 31.8, humidity: 82.0, pressure: 1011.9, battery: 3.41 },
              alert: true
            }
          ];

          const jsonInput = JSON.stringify(telemetryRecords, null, 2);

          // Convert JSON -> CSV (exercises dot-notation flattening on telemetry)
          const toCsv = sync.convertImmediate(jsonInput, 'json', 'csv');
          assert.ok(toCsv.success, 'Telemetry stream should convert to CSV');
          assert.ok(toCsv.result.includes('geo.latitude'));
          assert.ok(toCsv.result.includes('metrics.temperature'));
          assert.ok(toCsv.result.includes('106.6578'));

          // Convert CSV back to JSON (exercises dot-notation unflattening)
          const backToJson = sync.convertImmediate(toCsv.result, 'csv', 'json');
          assert.ok(backToJson.success);
          const parsed = JSON.parse(backToJson.result);
          assert.strictEqual(parsed.length, 3);
          assert.strictEqual(parsed[0].device_id, 'IOT-HCMUT-01');
          assert.strictEqual(parsed[0].geo.latitude, 10.7725);
          assert.strictEqual(parsed[0].metrics.temperature, 29.4);
          assert.strictEqual(parsed[2].alert, true);
        }
      },
      {
        name: 'Workload 3: E-Commerce Order Receipt & Inventory Catalog',
        run: function (assert, engine) {
          const sync = new engine.SyncEngine();
          const orderReceipt = {
            order: {
              order_id: 'ORD-2026-BK-7782',
              timestamp: '2026-11-05T09:15:00Z',
              customer: {
                id: 'CUST-0525',
                fullName: 'Nguyễn Minh Triết',
                phone: '+84901234567',
                shippingAddress: {
                  street: 'Đầu lộ Phú Mỹ',
                  district: 'Cái Nước',
                  province: 'Cà Mau',
                  country: 'Việt Nam'
                }
              },
              items: {
                item: [
                  { sku: 'KIT-EE-01', name: 'Kit Vi điều khiển STM32F4', unitPrice: 280000, quantity: 2, total: 560000 },
                  { sku: 'OSC-PRO-100', name: 'Dao động ký số 100MHz DSO', unitPrice: 4200000, quantity: 1, total: 4200000 }
                ]
              },
              payment: {
                method: 'VNPAY-QR',
                subtotal: 4760000,
                shippingFee: 30000,
                discount: 100000,
                grandTotal: 4690000,
                status: 'PAID'
              }
            }
          };

          const jsonInput = JSON.stringify(orderReceipt, null, 2);

          // Convert JSON -> XML
          const toXml = sync.convertImmediate(jsonInput, 'json', 'xml');
          assert.ok(toXml.success, 'E-commerce receipt should convert to valid XML');
          assert.ok(toXml.result.includes('<order_id>ORD-2026-BK-7782</order_id>'));
          assert.ok(toXml.result.includes('<province>Cà Mau</province>'));

          // Convert XML -> YAML
          const toYaml = sync.convertImmediate(toXml.result, 'xml', 'yaml');
          assert.ok(toYaml.success);
          assert.ok(toYaml.result.includes('Nguyễn Minh Triết'));
          assert.ok(toYaml.result.includes('4690000'));

          // Convert YAML -> JSON
          const backToJson = sync.convertImmediate(toYaml.result, 'yaml', 'json');
          assert.ok(backToJson.success);
          const parsed = JSON.parse(backToJson.result);
          assert.strictEqual(parsed.order.payment.grandTotal, 4690000);
          assert.strictEqual(parsed.order.customer.shippingAddress.province, 'Cà Mau');
        }
      },
      {
        name: 'Workload 4: Docker & Kubernetes Multi-Tier Configuration Matrix',
        run: function (assert, engine) {
          const sync = new engine.SyncEngine();
          const k8sDeploymentYaml = [
            'apiVersion: apps/v1',
            'kind: Deployment',
            'metadata:',
            '  name: omnisync-studio',
            '  namespace: production',
            '  labels:',
            '    app: omnisync',
            '    tier: frontend',
            '    version: v1.0.0',
            'spec:',
            '  replicas: 3',
            '  selector:',
            '    matchLabels:',
            '      app: omnisync',
            '  template:',
            '    metadata:',
            '      labels:',
            '        app: omnisync',
            '    spec:',
            '      containers:',
            '        - name: web-app',
            '          image: ghcr.io/nguyenminhtriet25052008-hub/omnisync-studio:v1.0.0',
            '          ports:',
            '            - containerPort: 80',
            '              protocol: TCP',
            '          env:',
            '            - name: NODE_ENV',
            '              value: production',
            '            - name: WORKBENCH_THEME',
            '              value: oled-dark',
            '          resources:',
            '            limits:',
            '              cpu: 500m',
            '              memory: 512Mi',
            '            requests:',
            '              cpu: 100m',
            '              memory: 128Mi'
          ].join('\n');

          // Convert YAML -> JSON
          const toJson = sync.convertImmediate(k8sDeploymentYaml, 'yaml', 'json');
          assert.ok(toJson.success, 'K8s deployment YAML should convert to JSON');
          const jsonParsed = JSON.parse(toJson.result);
          assert.strictEqual(jsonParsed.kind, 'Deployment');
          assert.strictEqual(jsonParsed.spec.replicas, 3);
          assert.strictEqual(jsonParsed.spec.template.spec.containers[0].ports[0].containerPort, 80);

          // Convert JSON -> XML
          const toXml = sync.convertImmediate(toJson.result, 'json', 'xml');
          assert.ok(toXml.success, 'K8s deployment JSON should convert to XML');
          assert.ok(toXml.result.includes('<kind>Deployment</kind>'));
          assert.ok(toXml.result.includes('<containerPort>80</containerPort>'));

          // Convert XML back to YAML
          const backToYaml = sync.convertImmediate(toXml.result, 'xml', 'yaml');
          assert.ok(backToYaml.success);
          assert.ok(backToYaml.result.includes('omnisync-studio'));
          assert.ok(backToYaml.result.includes('512Mi'));
        }
      },
      {
        name: 'Workload 5: Academic Student Gradebook & Curriculum (HCMUT - Nguyễn Minh Triết)',
        run: function (assert, engine) {
          const sync = new engine.SyncEngine();
          const academicRecord = {
            student: {
              student_id: '2610525',
              full_name: 'Nguyễn Minh Triết',
              birth_date: '2008-05-25',
              university: 'Trường Đại học Bách Khoa TP.HCM (HCMUT)',
              faculty: 'Khoa Điện - Điện tử',
              major: 'Kỹ thuật Điện tử - Viễn thông',
              cohort: 2026,
              academic_year: '2026-2027',
              semester: 1
            },
            courses: [
              {
                code: 'MT1003',
                name: 'Giải tích 1 (Calculus I)',
                credits: 4,
                mid_score: 9.5,
                final_score: 9.8,
                gpa_4: 4.0,
                letter_grade: 'A+'
              },
              {
                code: 'PH1003',
                name: 'Vật lý 1 (General Physics I)',
                credits: 4,
                mid_score: 9.0,
                final_score: 9.2,
                gpa_4: 4.0,
                letter_grade: 'A'
              },
              {
                code: 'EE1001',
                name: 'Nhập môn Kỹ thuật Điện - Điện tử',
                credits: 3,
                mid_score: 10.0,
                final_score: 9.8,
                gpa_4: 4.0,
                letter_grade: 'A+'
              },
              {
                code: 'CO1005',
                name: 'Kỹ thuật Lập trình (Programming Tech)',
                credits: 3,
                mid_score: 10.0,
                final_score: 10.0,
                gpa_4: 4.0,
                letter_grade: 'A+'
              }
            ],
            summary: {
              total_credits: 14,
              cumulative_gpa_4: 4.0,
              cumulative_gpa_10: 9.68,
              academic_standing: 'Xuất sắc (Excellent)'
            }
          };

          const jsonInput = JSON.stringify(academicRecord, null, 2);

          // 1. Convert JSON -> YAML
          const toYaml = sync.convertImmediate(jsonInput, 'json', 'yaml');
          assert.ok(toYaml.success, 'HCMUT gradebook should convert to YAML');
          assert.ok(toYaml.result.includes('Nguyễn Minh Triết'));
          assert.ok(toYaml.result.includes('Khoa Điện - Điện tử'));
          assert.ok(toYaml.result.includes('Giải tích 1'));

          // 2. Convert courses array directly to CSV for tabular transcript view
          const coursesCsv = sync.convertImmediate(JSON.stringify(academicRecord.courses), 'json', 'csv');
          assert.ok(coursesCsv.success, 'Courses transcript should serialize cleanly to CSV');
          assert.ok(coursesCsv.result.includes('MT1003'));
          assert.ok(coursesCsv.result.includes('CO1005'));
          assert.ok(coursesCsv.result.includes('A+'));

          // Re-parse transcript CSV back to objects and verify course calculations
          const reCourses = engine.parsers.csv.parse(coursesCsv.result);
          assert.ok(reCourses.success);
          assert.strictEqual(reCourses.data.length, 4);
          const totalCredits = reCourses.data.reduce((sum, c) => sum + Number(c.credits), 0);
          assert.strictEqual(totalCredits, 14, 'Credits total must equal 14');

          // 3. Convert YAML -> TOML -> JSON and verify cumulative GPA and university honors
          const toToml = sync.convertImmediate(toYaml.result, 'yaml', 'toml');
          assert.ok(toToml.success);
          const backToJson = sync.convertImmediate(toToml.result, 'toml', 'json');
          assert.ok(backToJson.success);

          const finalDoc = JSON.parse(backToJson.result);
          assert.strictEqual(finalDoc.student.full_name, 'Nguyễn Minh Triết');
          assert.strictEqual(finalDoc.student.faculty, 'Khoa Điện - Điện tử');
          assert.strictEqual(finalDoc.summary.cumulative_gpa_4, 4.0);
          assert.strictEqual(finalDoc.summary.academic_standing, 'Xuất sắc (Excellent)');
        }
      }
    ]
  });

  return suites;
});

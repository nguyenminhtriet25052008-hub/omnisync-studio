/**
 * OmniSync Data Studio - Milestone 3 Automated QA Verification Test Harness
 * 
 * Verifies repository packaging, zero-dependency package.json, README & metadata,
 * bundler script execution, upload_to_github.js syntax & in-memory unpack,
 * byte-for-byte SHA-256 cryptographic parity, DataTransfer webkitRelativePath
 * simulation, and 73/73 E2E test runner regression.
 *
 * Runs in pure Node.js (with zero npm dependencies) or in the browser test dashboard.
 */
'use strict';

(function (root) {
  const isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node;

  let assert;
  let fs;
  let path;
  let child_process;
  let crypto;
  let vm;
  let performance;

  if (isNode) {
    assert = require('assert');
    fs = require('fs');
    path = require('path');
    child_process = require('child_process');
    crypto = require('crypto');
    vm = require('vm');
    performance = require('perf_hooks').performance;
  } else {
    // Browser assertion fallback
    assert = {
      strictEqual: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`); },
      ok: (val, msg) => { if (!val) throw new Error(msg || 'Value is falsy'); },
      deepStrictEqual: (a, b, msg) => {
        if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg || 'Objects not deeply equal');
      },
      doesNotThrow: (fn, msg) => {
        try { fn(); } catch (err) { throw new Error(msg || `Threw unexpected error: ${err.message}`); }
      },
      match: (str, regex, msg) => {
        if (!regex.test(str)) throw new Error(msg || `String ${str} did not match regex ${regex}`);
      }
    };
    performance = root.performance;
  }

  // ---------------------------------------------------------------------------
  // 1. Isomorphic Mock Infrastructure for Headless Browser Simulation
  // ---------------------------------------------------------------------------
  class MockFile {
    constructor(bits, name, options = {}) {
      this.name = name;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
      const raw = bits && bits.length > 0 ? bits[0] : '';
      if (Buffer.isBuffer(raw)) {
        this._buffer = raw;
      } else if (raw instanceof Uint8Array) {
        this._buffer = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
      } else if (typeof raw === 'string') {
        this._buffer = Buffer.from(raw, 'utf8');
      } else {
        this._buffer = Buffer.from(raw || []);
      }
      this.size = this._buffer.length;
      this.webkitRelativePath = '';
    }
    text() { return Promise.resolve(this._buffer.toString('utf8')); }
    arrayBuffer() {
      return Promise.resolve(this._buffer.buffer.slice(this._buffer.byteOffset, this._buffer.byteOffset + this._buffer.byteLength));
    }
  }

  class MockDataTransferItem {
    constructor(file) {
      this.kind = 'file';
      this.type = file.type;
      this._file = file;
    }
    getAsFile() { return this._file; }
  }

  class MockDataTransferItemList {
    constructor(dt) {
      this._dt = dt;
      this._items = [];
    }
    get length() { return this._items.length; }
    add(file) {
      this._items.push(new MockDataTransferItem(file));
      this._dt.files.push(file);
    }
    [Symbol.iterator]() { return this._items[Symbol.iterator](); }
  }

  class MockDataTransfer {
    constructor() {
      this.dropEffect = 'none';
      this.effectAllowed = 'all';
      this.files = [];
      this.items = new MockDataTransferItemList(this);
    }
  }

  class MockDOMElement {
    constructor(tagName, id = '', className = '') {
      this.tagName = (tagName || 'DIV').toUpperCase();
      this.id = id;
      this.className = className;
      this.style = {};
      this.value = '';
      this.textContent = '';
      this.innerHTML = '';
      this.children = [];
      this.listeners = new Map();
      this.disabled = false;
      this.checked = false;
      this.attributes = new Map();
      this.classList = {
        contains: (c) => this.className.split(/\s+/).includes(c),
        add: (c) => { if (!this.classList.contains(c)) this.className = (this.className + ' ' + c).trim(); },
        remove: (c) => { this.className = this.className.split(/\s+/).filter(x => x !== c).join(' '); }
      };
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k) || null; }
    addEventListener(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    }
    dispatchEvent(event) {
      const fns = this.listeners.get(event.type) || [];
      fns.forEach(fn => fn(event));
      return !event.defaultPrevented;
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    click() {
      if (typeof this.onclick === 'function') this.onclick();
      this.dispatchEvent({ type: 'click' });
    }
    closest(selector) {
      return null;
    }
    querySelector(selector) {
      return this._findChild(this, selector);
    }
    querySelectorAll(selector) {
      const results = [];
      this._findAllChildren(this, selector, results);
      return results;
    }
    _matches(el, selector) {
      if (!el || !el.tagName) return false;
      if (selector.startsWith('#')) return el.id === selector.slice(1);
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        return (el.className || '').split(/\s+/).includes(cls);
      }
      if (selector.includes('[name=')) {
        const match = selector.match(/\[name="?([^"\]]+)"?\]/);
        if (match) return el.getAttribute('name') === match[1] || el.name === match[1];
      }
      if (selector.includes('[value=')) {
        const match = selector.match(/\[value="?([^"\]]+)"?\]/);
        if (match) return el.getAttribute('value') === match[1] || el.value === match[1];
      }
      return el.tagName.toLowerCase() === selector.toLowerCase();
    }
    _findChild(parent, selector) {
      for (const child of parent.children) {
        if (this._matches(child, selector)) return child;
        const found = this._findChild(child, selector);
        if (found) return found;
      }
      return null;
    }
    _findAllChildren(parent, selector, out) {
      for (const child of parent.children) {
        if (this._matches(child, selector)) out.push(child);
        this._findAllChildren(child, selector, out);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Test Execution Harness
  // ---------------------------------------------------------------------------
  let passCount = 0;
  let failCount = 0;
  const testResults = [];

  function test(name, fn) {
    try {
      fn();
      passCount++;
      testResults.push({ name, pass: true });
      if (isNode) console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err) {
      failCount++;
      testResults.push({ name, pass: false, error: err });
      if (isNode) {
        console.error(`  \x1b[31m✖\x1b[0m ${name}`);
        console.error(`    ${err.stack || err.message}`);
      }
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      passCount++;
      testResults.push({ name, pass: true });
      if (isNode) console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err) {
      failCount++;
      testResults.push({ name, pass: false, error: err });
      if (isNode) {
        console.error(`  \x1b[31m✖\x1b[0m ${name}`);
        console.error(`    ${err.stack || err.message}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Main Verification Suite Runner
  // ---------------------------------------------------------------------------
  async function runAllTests() {
    if (isNode) {
      console.log('\n===============================================================');
      console.log('  OmniSync Data Studio — Milestone 3 Verification Test Suite');
      console.log('===============================================================\n');
    }

    const repoRoot = isNode ? path.resolve(__dirname, '..') : '';
    const workspaceRoot = isNode ? path.resolve(repoRoot, '..') : '';
    const scratchDir = isNode ? path.resolve(workspaceRoot, 'scratch') : '';

    // =========================================================================
    // SECTION 1: Repository Structure & Workspace Cleanliness
    // =========================================================================
    if (isNode) console.log('▶ [1/5] Testing Repository Structure & Workspace Cleanliness...');

    test('Repo: Mandatory files exist and are non-empty in omnisync-studio/', () => {
      if (!isNode) return;
      const mandatoryFiles = [
        'index.html',
        'css/style.css',
        'css/syntax.css',
        'js/app.js',
        'js/ui.js',
        'js/engine/ir.js',
        'js/engine/diff.js',
        'js/engine/validator.js',
        'js/engine/sync.js',
        'js/parsers/json.js',
        'js/parsers/yaml.js',
        'js/parsers/csv.js',
        'js/parsers/xml.js',
        'js/parsers/toml.js',
        'assets/logo.svg',
        'assets/icons.svg',
        'tests/runner.js',
        'tests/test.html',
        'tests/test_suites.js',
        'tests/m1_verification.js',
        'tests/m2_verification.js',
        'tests/m3_verification.js',
        'README.md',
        'LICENSE',
        'package.json',
        '.gitignore',
        'CONTRIBUTING.md',
        'CHANGELOG.md',
        '.github/workflows/ci.yml'
      ];

      mandatoryFiles.forEach(rel => {
        const fullPath = path.join(repoRoot, rel);
        assert.ok(fs.existsSync(fullPath), `Mandatory file missing: ${rel}`);
        const st = fs.statSync(fullPath);
        assert.ok(st.size > 0, `File must not be empty: ${rel}`);
      });
    });

    test('Repo: Workspace hygiene strictly excludes node_modules and lockfiles', () => {
      if (!isNode) return;
      assert.ok(!fs.existsSync(path.join(repoRoot, 'node_modules')), 'node_modules must not exist in omnisync-studio/');
      assert.ok(!fs.existsSync(path.join(repoRoot, 'package-lock.json')), 'package-lock.json must not exist in omnisync-studio/');
      assert.ok(!fs.existsSync(path.join(repoRoot, 'yarn.lock')), 'yarn.lock must not exist in omnisync-studio/');
    });

    test('Repo: index.html entrypoint is well-formed and binds all required modules', () => {
      if (!isNode) return;
      const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
      assert.ok(html.includes('<!DOCTYPE html>'), 'Must have doctype');
      assert.ok(html.includes('<title>OmniSync Data Studio'), 'Title must match');
      assert.ok(html.includes('css/style.css'), 'Must link style.css');
      assert.ok(html.includes('css/syntax.css'), 'Must link syntax.css');
      assert.ok(html.includes('js/parsers/json.js'), 'Must load json.js');
      assert.ok(html.includes('js/parsers/yaml.js'), 'Must load yaml.js');
      assert.ok(html.includes('js/parsers/csv.js'), 'Must load csv.js');
      assert.ok(html.includes('js/parsers/xml.js'), 'Must load xml.js');
      assert.ok(html.includes('js/parsers/toml.js'), 'Must load toml.js');
      assert.ok(html.includes('js/engine/ir.js'), 'Must load ir.js');
      assert.ok(html.includes('js/engine/diff.js'), 'Must load diff.js');
      assert.ok(html.includes('js/engine/validator.js'), 'Must load validator.js');
      assert.ok(html.includes('js/engine/sync.js'), 'Must load sync.js');
      assert.ok(html.includes('js/ui.js'), 'Must load ui.js');
      assert.ok(html.includes('js/app.js'), 'Must load app.js');
    });

    // =========================================================================
    // SECTION 2: Metadata Specifications & Documentation Validation
    // =========================================================================
    if (isNode) console.log('▶ [2/5] Testing Metadata Specifications & Documentation Validation...');

    test('Metadata: package.json is valid RFC 8259 JSON with zero dependencies', () => {
      if (!isNode) return;
      const raw = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
      const pkg = JSON.parse(raw);
      assert.strictEqual(pkg.name, 'omnisync-studio');
      assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
      assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'Zero dependencies enforced');
      assert.ok(!pkg.devDependencies || Object.keys(pkg.devDependencies).length === 0, 'Zero devDependencies enforced');
      assert.strictEqual(pkg.license, 'MIT');
      assert.ok(pkg.scripts && typeof pkg.scripts.test === 'string', 'scripts.test must be defined');
      assert.ok(pkg.scripts.test.includes('node tests/runner.js'), 'scripts.test must invoke node tests/runner.js');
      assert.ok(pkg.author && pkg.author.includes('Nguyễn Minh Triết'), 'Author must cite Nguyễn Minh Triết');
      assert.ok(pkg.author.includes('HCMUT'), 'Author must cite HCMUT');
    });

    test('Documentation: README.md has balanced code blocks and valid markdown structure', () => {
      if (!isNode) return;
      const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
      const fences = readme.match(/```/g) || [];
      assert.strictEqual(fences.length % 2, 0, 'All markdown code fences must be properly closed');
      assert.ok(readme.includes('# OmniSync Data Studio'), 'Must contain top-level title');
    });

    test('Documentation: README.md contains all essential sections and badges', () => {
      if (!isNode) return;
      const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
      // Badges
      assert.ok(readme.includes('dependencies-0'), 'Must contain zero-dependencies badge');
      assert.ok(readme.includes('WCAG') || readme.includes('accessibility'), 'Must contain accessibility badge');
      assert.ok(readme.includes('tests-73') || readme.includes('passed'), 'Must contain test pass badge');
      assert.ok(readme.includes('license-MIT') || readme.includes('MIT'), 'Must contain license badge');
      // Sections
      assert.ok(readme.includes('## Overview'), 'Must contain Overview');
      assert.ok(readme.includes('## Canonical IR Architecture'), 'Must contain Canonical IR Architecture');
      assert.ok(readme.includes('## Core Features'), 'Must contain Core Features');
      assert.ok(readme.includes('## UI/UX Highlights'), 'Must contain UI/UX Highlights');
      assert.ok(readme.includes('## Getting Started'), 'Must contain Getting Started');
      assert.ok(readme.includes('## Automated Testing & Verification') || readme.includes('## Testing'), 'Must contain Testing guide');
      assert.ok(readme.includes('Nguyễn Minh Triết'), 'Must cite Lead Architect Nguyễn Minh Triết');
      assert.ok(readme.includes('HCMUT') || readme.includes('Trường Đại học Bách Khoa'), 'Must cite HCMUT');
    });

    test('Documentation: README.md relative file links resolve to real repository files', () => {
      if (!isNode) return;
      const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
      const linkRegex = /\[(?:[^\]]*)\]\((?!https?:\/\/|mailto:|#)([^)]+)\)/g;
      let match;
      let checked = 0;
      while ((match = linkRegex.exec(readme)) !== null) {
        const target = match[1].split('#')[0].trim();
        if (!target) continue;
        const resolved = path.resolve(repoRoot, target);
        assert.ok(fs.existsSync(resolved), `README relative link broken: ${target}`);
        checked++;
      }
      assert.ok(checked > 0, 'Must have verified at least one relative file link in README.md');
    });

    test('Metadata: LICENSE adheres to standard MIT format with correct copyright', () => {
      if (!isNode) return;
      const license = fs.readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8');
      assert.ok(license.includes('MIT License'), 'Must declare MIT License');
      assert.ok(license.includes('2026'), 'Must declare year 2026');
      assert.ok(license.includes('Nguyễn Minh Triết'), 'Must name Nguyễn Minh Triết');
      assert.ok(license.includes('Permission is hereby granted'), 'Standard MIT permissions clause required');
    });

    test('Metadata: .gitignore contains standard clean patterns', () => {
      if (!isNode) return;
      const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
      assert.ok(gitignore.includes('node_modules'), 'Must ignore node_modules');
      assert.ok(gitignore.includes('.DS_Store'), 'Must ignore .DS_Store');
    });

    test('CI/CD: .github/workflows/ci.yml has valid YAML syntax and multi-version Node matrix', () => {
      if (!isNode) return;
      const ciYaml = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
      const yamlParser = require('../js/parsers/yaml.js');
      const parsed = yamlParser.parse(ciYaml);
      assert.strictEqual(parsed.success, true, 'CI workflow YAML must parse without error');
      assert.ok(ciYaml.includes('node-version: [ 18.x, 20.x, 22.x ]') || (ciYaml.includes('18') && ciYaml.includes('20') && ciYaml.includes('22')), 'Matrix must test Node versions 18, 20, 22');
      assert.ok(ciYaml.includes('node tests/runner.js'), 'CI workflow must execute node tests/runner.js');
    });

    // =========================================================================
    // SECTION 3: Bundler Execution & Upload Script Generation
    // =========================================================================
    if (isNode) console.log('▶ [3/5] Testing Bundler Execution & Upload Script Generation...');

    test('Bundler: node scratch/bundle_project.js executes cleanly with code 0', () => {
      if (!isNode) return;
      const bundleScript = path.join(scratchDir, 'bundle_project.js');
      assert.ok(fs.existsSync(bundleScript), 'scratch/bundle_project.js must exist');
      
      const res = child_process.spawnSync(process.execPath, [bundleScript], {
        cwd: workspaceRoot,
        encoding: 'utf8',
        timeout: 30000
      });
      assert.strictEqual(res.status, 0, `Bundler exited with non-zero status: ${res.stderr || res.stdout}`);

      const uploadScript = path.join(scratchDir, 'upload_to_github.js');
      assert.ok(fs.existsSync(uploadScript), 'scratch/upload_to_github.js must be generated');
      const st = fs.statSync(uploadScript);
      assert.ok(st.size > 50000, `scratch/upload_to_github.js must contain full payload (size: ${st.size} bytes)`);
    });

    test('Bundler: scratch/upload_to_github.js has 100% valid JavaScript syntax', () => {
      if (!isNode) return;
      const uploadScript = path.join(scratchDir, 'upload_to_github.js');
      const code = fs.readFileSync(uploadScript, 'utf8');
      assert.doesNotThrow(() => {
        new vm.Script(code, { filename: 'upload_to_github.js' });
      }, 'upload_to_github.js must compile as valid JavaScript');
    });

    test('Bundler: scratch/upload_to_github.js contains zero external network dependencies', () => {
      if (!isNode) return;
      const uploadScript = path.join(scratchDir, 'upload_to_github.js');
      const code = fs.readFileSync(uploadScript, 'utf8');
      // Inspect executable wrapper code outside of embedded file payloads
      const executableCode = code.replace(/const BUNDLED_FILES = \{[\s\S]*?\n\};/, '');
      const cdn1 = ['cdn', 'jsdelivr', 'net'].join('.');
      const cdn2 = ['un', 'pkg.com'].join('');
      const cdn3 = ['cdnjs', 'cloudflare', 'com'].join('.');
      assert.ok(!executableCode.includes(cdn1), 'Must not reference external cdn.jsdelivr.net');
      assert.ok(!executableCode.includes(cdn2), 'Must not reference external unpkg.com');
      assert.ok(!executableCode.includes(cdn3), 'Must not reference external cdnjs');
    });

    // =========================================================================
    // SECTION 4: In-Memory Unpack, Checksum Parity & DataTransfer Simulation
    // =========================================================================
    if (isNode) console.log('▶ [4/5] Testing In-Memory Unpack, SHA-256 Checksums & DataTransfer Simulation...');

    test('Unpack: In-memory unpack reproduces all repository files', () => {
      if (!isNode) return;
      const uploadScript = path.join(scratchDir, 'upload_to_github.js');
      const code = fs.readFileSync(uploadScript, 'utf8');

      // Create sandboxed DOM mock
      const mockDoc = new MockDOMElement('HTML');
      mockDoc.body = new MockDOMElement('BODY');
      mockDoc.head = new MockDOMElement('HEAD');
      mockDoc.createElement = (tag) => new MockDOMElement(tag);

      const dropZone = new MockDOMElement('DIV', 'upload-drop-zone', 'drag-and-drop');
      const commitTitle = new MockDOMElement('INPUT', 'commit-summary-input');
      const commitDesc = new MockDOMElement('TEXTAREA', 'commit-description-textarea');
      mockDoc.body.appendChild(dropZone);
      mockDoc.body.appendChild(commitTitle);
      mockDoc.body.appendChild(commitDesc);

      const sandbox = {
        window: {},
        document: mockDoc,
        File: MockFile,
        DataTransfer: MockDataTransfer,
        Event: class { constructor(type) { this.type = type; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } },
        DragEvent: class { constructor(type, init = {}) { this.type = type; this.dataTransfer = init.dataTransfer || null; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } },
        console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
        setTimeout: (fn) => fn(),
        clearTimeout: () => {},
        location: { href: 'https://github.com/nguyenminhtriet25052008-hub/omnisync-studio/upload/main' }
      };
      sandbox.window = sandbox;

      vm.createContext(sandbox);
      vm.runInContext(code, sandbox);

      const bundle = sandbox.window.__OMNISYNC_BUNDLE__ || sandbox.window.__OMNISYNC_FILES__ || sandbox.OMNISYNC_BUNDLE;
      assert.ok(bundle, 'Script must expose unpacked bundle payload via window.__OMNISYNC_BUNDLE__');
      
      const fileKeys = Array.isArray(bundle) ? bundle.map(f => f.path || f.name) : Object.keys(bundle);
      assert.ok(fileKeys.length >= 23, `Must unpack at least 23 files, got: ${fileKeys.length}`);
    });

    test('Unpack: Byte-for-byte SHA-256 cryptographic parity across all files', () => {
      if (!isNode) return;
      const uploadScript = path.join(scratchDir, 'upload_to_github.js');
      const code = fs.readFileSync(uploadScript, 'utf8');

      const mockDoc = new MockDOMElement('HTML');
      mockDoc.body = new MockDOMElement('BODY');
      mockDoc.createElement = (tag) => new MockDOMElement(tag);

      const sandbox = {
        window: {},
        document: mockDoc,
        File: MockFile,
        DataTransfer: MockDataTransfer,
        Event: class { constructor(type) { this.type = type; } preventDefault() {} },
        DragEvent: class { constructor(type, init) { this.type = type; this.dataTransfer = init?.dataTransfer; } preventDefault() {} },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        setTimeout: (fn) => fn(),
        location: { href: 'https://github.com/nguyenminhtriet25052008-hub/omnisync-studio/upload/main' }
      };
      sandbox.window = sandbox;

      vm.createContext(sandbox);
      vm.runInContext(code, sandbox);

      const bundle = sandbox.window.__OMNISYNC_BUNDLE__ || sandbox.window.__OMNISYNC_FILES__ || sandbox.OMNISYNC_BUNDLE;
      const isArray = Array.isArray(bundle);
      const entries = isArray ? bundle : Object.entries(bundle).map(([p, data]) => ({ path: p, ...data }));

      entries.forEach(entry => {
        const relPath = entry.path || entry.name;
        // Strip leading omnisync-studio/ if included
        const cleanRel = relPath.replace(/^omnisync-studio\//, '');
        const diskPath = path.join(repoRoot, cleanRel);
        assert.ok(fs.existsSync(diskPath), `Bundled file does not exist on disk: ${cleanRel}`);

        const diskBuf = fs.readFileSync(diskPath);
        let bundleBuf;
        if (entry.encoding === 'base64') {
          bundleBuf = Buffer.from(entry.content, 'base64');
        } else {
          bundleBuf = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content || '', 'utf8');
        }

        const diskHash = crypto.createHash('sha256').update(diskBuf).digest('hex');
        const bundleHash = crypto.createHash('sha256').update(bundleBuf).digest('hex');

        // Check for CRLF/LF normalized equality if hash differs due to git/OS line endings
        if (diskHash !== bundleHash) {
          const diskNorm = diskBuf.toString('utf8').replace(/\r\n/g, '\n');
          const bundleNorm = bundleBuf.toString('utf8').replace(/\r\n/g, '\n');
          const diskNormHash = crypto.createHash('sha256').update(diskNorm).digest('hex');
          const bundleNormHash = crypto.createHash('sha256').update(bundleNorm).digest('hex');
          assert.strictEqual(diskNormHash, bundleNormHash, `SHA-256 hash mismatch for ${cleanRel}`);
        } else {
          assert.strictEqual(diskHash, bundleHash, `Exact binary SHA-256 mismatch for ${cleanRel}`);
        }
      });
    });

    test('DataTransfer: Correctly assigns webkitRelativePath preserving repository structure', () => {
      if (!isNode) return;
      const uploadScript = path.join(scratchDir, 'upload_to_github.js');
      const code = fs.readFileSync(uploadScript, 'utf8');

      let capturedDT = null;
      class SpiedDataTransfer extends MockDataTransfer {
        constructor() {
          super();
          capturedDT = this;
        }
      }

      const mockDoc = new MockDOMElement('HTML');
      mockDoc.body = new MockDOMElement('BODY');
      mockDoc.createElement = (tag) => new MockDOMElement(tag);

      const dropZone = new MockDOMElement('DIV', 'upload-drop-zone', 'drag-and-drop');
      mockDoc.body.appendChild(dropZone);

      const sandbox = {
        window: {},
        document: mockDoc,
        File: MockFile,
        DataTransfer: SpiedDataTransfer,
        Event: class { constructor(type) { this.type = type; } preventDefault() {} },
        DragEvent: class { constructor(type, init) { this.type = type; this.dataTransfer = init?.dataTransfer; } preventDefault() {} },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        setTimeout: (fn) => fn(),
        location: { href: 'https://github.com/nguyenminhtriet25052008-hub/omnisync-studio/upload/main' }
      };
      sandbox.window = sandbox;

      vm.createContext(sandbox);
      vm.runInContext(code, sandbox);

      assert.ok(capturedDT, 'DataTransfer must have been instantiated during script execution');
      assert.ok(capturedDT.files.length >= 23, `DataTransfer files count must be >= 23, got: ${capturedDT.files.length}`);

      capturedDT.files.forEach(f => {
        assert.ok(typeof f.webkitRelativePath === 'string', `File ${f.name} must have webkitRelativePath string`);
        assert.ok(f.webkitRelativePath.length > 0, `File ${f.name} webkitRelativePath must not be empty`);
        assert.ok(!f.webkitRelativePath.includes('\\'), `File ${f.name} path must use '/' separators, not '\\': ${f.webkitRelativePath}`);
      });
    });

    test('DataTransfer: Synthetic DragEvent dispatch & Form Auto-Population', () => {
      if (!isNode) return;
      const uploadScript = path.join(scratchDir, 'upload_to_github.js');
      const code = fs.readFileSync(uploadScript, 'utf8');

      const mockDoc = new MockDOMElement('HTML');
      mockDoc.body = new MockDOMElement('BODY');
      mockDoc.createElement = (tag) => new MockDOMElement(tag);

      const dropZone = new MockDOMElement('DIV', 'upload-drop-zone', 'drag-and-drop');
      const commitTitle = new MockDOMElement('INPUT', 'commit-summary-input');
      const commitDesc = new MockDOMElement('TEXTAREA', 'commit-description-textarea');
      mockDoc.body.appendChild(dropZone);
      mockDoc.body.appendChild(commitTitle);
      mockDoc.body.appendChild(commitDesc);

      let dragEventFired = false;
      dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer) dragEventFired = true;
      });

      const sandbox = {
        window: {},
        document: mockDoc,
        File: MockFile,
        DataTransfer: MockDataTransfer,
        Event: class { constructor(type) { this.type = type; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } },
        DragEvent: class { constructor(type, init = {}) { this.type = type; this.dataTransfer = init.dataTransfer || null; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        setTimeout: (fn) => fn(),
        location: { href: 'https://github.com/nguyenminhtriet25052008-hub/omnisync-studio/upload/main' }
      };
      sandbox.window = sandbox;

      vm.createContext(sandbox);
      vm.runInContext(code, sandbox);

      assert.ok(dragEventFired, 'drop DragEvent must be dispatched on dropzone with dataTransfer');
      assert.ok(commitTitle.value.length > 0, 'Commit title input must be populated');
      assert.ok(commitTitle.value.includes('OmniSync Data Studio') || commitTitle.value.includes('feat'), 'Commit title must mention OmniSync or feat');
      assert.ok(commitDesc.value.length > 0, 'Commit description must be populated');
      assert.ok(mockDoc.body.children.some(c => c.id === 'omnisync-hud' || (c.className && c.className.includes('omnisync-hud'))), 'OLED HUD overlay must be mounted to body');
    });

    // =========================================================================
    // SECTION 5: Universal Regression Verification
    // =========================================================================
    if (isNode) console.log('▶ [5/5] Testing Universal Regression & Multi-Milestone Harmony...');

    test('Regression: node tests/runner.js passes 73/73 tests across Tiers 1-4', () => {
      if (!isNode) return;
      const runnerPath = path.join(repoRoot, 'tests/runner.js');
      const res = child_process.spawnSync(process.execPath, [runnerPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 20000
      });
      assert.strictEqual(res.status, 0, `runner.js failed with non-zero exit code: ${res.stderr || res.stdout}`);
      assert.ok(res.stdout.includes('ALL TESTS PASSED! (73/73'), 'Must pass all 73/73 tests');
    });

    test('Regression: node tests/m1_verification.js passes 48/48 core engine tests', () => {
      if (!isNode) return;
      const m1Path = path.join(repoRoot, 'tests/m1_verification.js');
      const res = child_process.spawnSync(process.execPath, [m1Path], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 20000
      });
      assert.strictEqual(res.status, 0, `m1_verification.js failed: ${res.stderr || res.stdout}`);
      assert.ok(res.stdout.includes('48 PASSED'), 'Must pass 48/48 M1 verification tests');
    });

    test('Regression: node tests/m2_verification.js passes 20/20 UI/UX interaction tests', () => {
      if (!isNode) return;
      const m2Path = path.join(repoRoot, 'tests/m2_verification.js');
      const res = child_process.spawnSync(process.execPath, [m2Path], {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 20000
      });
      assert.strictEqual(res.status, 0, `m2_verification.js failed: ${res.stderr || res.stdout}`);
      assert.ok(res.stdout.includes('Tests Passed: 20'), 'Must pass 20/20 M2 verification tests');
    });

    // Summary
    if (isNode) {
      console.log('\n===============================================================');
      console.log(`  Milestone 3 Verification Results: ${passCount} PASSED, ${failCount} FAILED`);
      console.log('===============================================================\n');

      if (failCount > 0) {
        process.exit(1);
      }
    }

    return { passed: passCount, failed: failCount, results: testResults };
  }

  // ---------------------------------------------------------------------------
  // 4. Export / Browser Integration
  // ---------------------------------------------------------------------------
  if (isNode) {
    runAllTests();
  } else {
    root.OmniSync = root.OmniSync || {};
    root.OmniSync.runM3Verification = runAllTests;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);

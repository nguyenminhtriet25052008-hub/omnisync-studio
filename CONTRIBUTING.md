# Contributing to OmniSync Data Studio

Thank you for your interest in contributing to **OmniSync Data Studio**! We welcome bug reports, format improvement proposals, and accessibility enhancements.

## Core Architectural Guiding Principles

Before submitting a Pull Request, please ensure your contribution adheres to the foundational design rules of OmniSync:

1. **Strict Zero-Dependency Policy**: OmniSync does NOT use external npm runtime or build packages. All parsers, serializers, diagnostics, and UI elements must be implemented in pure, vanilla JavaScript and standard Web APIs.
2. **Canonical IR Hub-and-Spoke Pattern**: New formats or transformations must hook into the Canonical Intermediate Representation (`js/engine/ir.js`). Never implement point-to-point cross-translators.
3. **Isomorphic Node and Browser Compatibility**: All parsers and engine modules must execute flawlessly in both modern browsers (ES6+) and Node.js environments (CommonJS/module wrappers).
4. **WCAG AAA Accessibility**: Every UI enhancement must maintain high contrast ratios (> 7:1), provide accessible ARIA semantics, support full keyboard navigation, and provide clear screen-reader announcements.
5. **100% Test Pass Guarantee**: All pull requests must pass the universal test suite (`node tests/runner.js`) and UI verification (`node tests/m2_verification.js`).

## Development Workflow

1. Fork the repository and clone your fork:
   ```bash
   git clone https://github.com/<your-username>/omnisync-studio.git
   cd omnisync-studio
   ```
2. Make your edits to the relevant files in `js/`, `css/`, or `index.html`.
3. Run the automated test suites:
   ```bash
   node tests/runner.js
   node tests/m2_verification.js
   ```
4. Verify browser operation by opening `index.html` directly in your browser.
5. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat(parsers): improve TOML multiline string escape handling"
   ```
6. Open a Pull Request targeting the `main` branch.

## Code Style Guidelines

- Use clean, modern vanilla JavaScript with `'use strict';`.
- Include line/column diagnostic coordinate tracking on syntax error exceptions.
- Keep comments concise and focused on rationale and algorithmic invariants.

Thank you for helping keep OmniSync fast, private, and zero-dependency!

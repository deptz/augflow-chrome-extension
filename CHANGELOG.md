# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Remote/LAN/HTTPS Augflow base URLs with optional host permission prompt.
- Default **project identifier** in options (registry key, not absolute-path-only).
- Board modal / `selectedIssue` import via content-script issue key sync.
- Options: project/repository dropdowns (load via **Test connection** below base URL); checkbox layout fix.
- **Shift+click** quick import; **click** opens dialog to choose project, repository, and import-only vs import+start.
- Per-project **default repository** in options; `PATCH` task `repo_slug` after import.
- **Import with options** shortcut (Ctrl+Shift+U) and context menu.

## [0.1.0] - 2026-05-09

### Added

- Initial open-source release: MV3 bridge from Jira Cloud (`*.atlassian.net`) to local Augflow (`import-by-key` + optional `cards/start`).
- Options page, floating page button, toolbar action, tests, ESLint, CI workflow.

[Unreleased]: https://github.com/deptz/augflow-chrome-extension/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/deptz/augflow-chrome-extension/releases/tag/v0.1.0

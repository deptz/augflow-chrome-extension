# Augflow Jira Bridge (Chrome / Edge)

[![CI](https://github.com/deptz/augflow-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/deptz/augflow-chrome-extension/actions/workflows/ci.yml)

Open-source **Manifest V3** extension: from a **Jira Cloud** issue page (`*.atlassian.net`), send the issue key to **Augflow** via **`POST /api/tasks/jira/import-by-key`**, and optionally **`POST /api/cards/start`**.

**Not affiliated with** Atlassian, Google, or Microsoft. Jira® is a trademark of Atlassian.

## License

**MIT** — see [LICENSE](./LICENSE).

## Requirements

- **Augflow** with `/api/tasks/jira/import-by-key`.
- Node **20+** if you build from source.
- **Chrome** or **Edge** (MV3).

## Install

Download a release zip or build `dist/` and **Load unpacked** from `chrome://extensions` (Developer mode). See [Build from source](#build-from-source).

## Configure

Open **Options** (extension details → Extension options).

| Setting | Meaning |
|---------|--------|
| **Augflow base URL** | Default `http://localhost:4400`. Local dev, LAN (`http://192.168.x.x`), or HTTPS team server. Chrome asks to allow the host on first save/test. |
| **Default project** | Project identifier for `X-Project-Path` (same value as Augflow’s project switcher — usually a registry **key**, not a filesystem path). |
| **Default repository** | Per-project repo slug from `GET /api/config/repos` (shown after Test connection). Applied via `PATCH /api/tasks/{id}` after import. |
| **API token** | Optional `Authorization: Bearer …` if Augflow `api.api_token` is set. |
| **Auto-start card** | On **quick** import (toolbar, ⌘⇧Y / Ctrl+Shift+Y, Shift+click), also call `POST /api/cards/start`. |

**Test connection** (below base URL) calls `GET /health` and loads the **default project** and **default repository** dropdowns.

## Usage

On a Jira Cloud issue (URL or board modal with `selectedIssue=KEY`):

- **Toolbar** / **Ctrl+Shift+Y** (Mac: **⌘⇧Y**) — **quick import** with default project, repository, and auto-start setting.
- **Shift+click** floating **Import to Augflow** button — same quick import.
- **Click** floating button — dialog: pick **project**, **repository**, and **Import only** vs **Import + start**.
- **Ctrl+Shift+U** (Mac: **⌘⇧U**) or context menu **Import with options…** — same dialog.

Board issue drawer URLs like `…/boards/345?selectedIssue=BIF-8246` are supported (content script + `selectedIssue` query).

## API flow

1. `POST {base}/api/tasks/jira/import-by-key` — `{ "issue_key": "PROJ-123" }` + `X-Project-Path`.
2. If starting a card — `POST {base}/api/cards/start` — `{ "task_ids": ["PROJ-123"] }`.

## Build from source

```bash
npm install
npm run verify   # lint + tsc + tests + build → dist/
```

Load **`dist/`** as unpacked. Use `npm run watch` while iterating.

## Jira Data Center / custom hosts

Only `https://*.atlassian.net/*` is declared. For other Jira hosts, extend `manifest.json` and `isJiraCloudHost()` in `src/background.ts`.

## Security

See [SECURITY.md](./SECURITY.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

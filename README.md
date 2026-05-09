# Augflow Jira Bridge (Chrome / Edge)

[![CI](https://github.com/deptz/augflow-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/deptz/augflow-chrome-extension/actions/workflows/ci.yml)

Open-source **Manifest V3** extension: from a **Jira Cloud** issue page (`*.atlassian.net`), send the issue key to **Augflow** running on your machine (**`augflow serve`**, typically port **4400**), via **`POST /api/tasks/jira/import-by-key`**, and optionally **`POST /api/cards/start`**.

**Not affiliated with** Atlassian, Google, or Microsoft. Jira® is a trademark of Atlassian.

Badge and **`package.json`** links assume the canonical repo is **`github.com/deptz/augflow-chrome-extension`**; if you fork, update those URLs (see [CONTRIBUTING](./CONTRIBUTING.md)).

## License

**MIT** — see [LICENSE](./LICENSE).

## Requirements

- **Augflow** with the `/api/tasks/jira/import-by-key` API (same generation as upstream Augflow docs / project).
- Node **20+** if you build from source.
- **Chrome** or **Edge** (MV3-compatible).

## Install (from GitHub Releases)

Each release attaches a **`augflow-jira-bridge-vX.Y.Z.zip`** built in CI:

1. Download and **unzip** the archive — you must see **`manifest.json`** at the **top level** of the extracted folder (not nested under another folder).
2. **Chrome**: `chrome://extensions` → **Developer mode** → **Load unpacked** → pick that folder.
3. **Edge**: `edge://extensions` → **Developer mode** → **Load unpacked**.

Pin the version if you rely on reproducible installs; semver tags describe the bundled `manifest.json` version.

## Build from source

```bash
git clone https://github.com/deptz/augflow-chrome-extension.git
cd augflow-chrome-extension
npm install
npm run verify   # lint + TypeScript + tests + production build → dist/
```

Then load **`dist/`** as **Load unpacked** (Chrome / Edge extensions page).

Watch mode while iterating:

```bash
npm run watch
```

Rebuild and hit **Reload** on the extension card after changes.

### Produce a zip (for Releases or teammates)

```bash
npm run release:zip
```

Creates **`.artifacts/augflow-jira-bridge-v<version>.zip`** from **`dist/`** (gitignored).

## Configure

Open **Options**: from the toolbar icon menu (Extensions → Augflow Jira Bridge → Details / extension options).

| Setting | Meaning |
|---------|--------|
| **Augflow base URL** | Default `http://localhost:4400`. Only **`http`** to **`localhost`** / **`127.0.0.1`** with an allowlisted port — see `src/lib/augflowUrl.ts`. |
| **Project path** | Absolute path sent as **`X-Project-Path`**; must match a project registered in Augflow. |
| **API token** | Optional **`Authorization: Bearer …`** if Augflow `api.api_token` is set. Stored in extension storage only; **not** injected into Jira pages. |
| **Auto-start card** | After import, call **`POST /api/cards/start`** with `{ "task_ids": ["PROJ-123"] }`. |

**Test connection** calls **`GET /health`** (no project header).

## Usage

On a Jira Cloud **issue** URL (see `src/lib/issueKey.ts` for supported patterns):

- Toolbar: **Import `{KEY}` to Augflow** — click or **⌘⇧Y** / **Ctrl+Shift+Y** (suggested shortcut for the browser action).
- Optional floating **Import to Augflow** button on the page (DOM fallback via `data-issue-key`).

Elsewhere, the action is **disabled** for that tab.

## API flow

1. **`POST {base}/api/tasks/jira/import-by-key`** — body `{ "issue_key": "PROJ-123" }`.
2. If **Auto-start card** is on — **`POST {base}/api/cards/start`** — `{ "task_ids": ["PROJ-123"] }`.

If (1) fails, (2) is not run. Errors use Augflow’s JSON **`message`** when present.

## Jira Data Center / custom hosts

Only **`https://*.atlassian.net/*`** is declared in `manifest.json`. For other hosts, extend **`host_permissions`** and **`content_scripts.matches`**, and update **`isJiraCloudHost()`** in `src/background.ts`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## Privacy (short)

The extension reads the **tab URL** on Atlassian pages to infer the issue key, stores **settings** (and optional API token) in **`chrome.storage.sync`**, shows **notifications** for results, and sends HTTP requests to **your local Augflow** and **Atlassian** as declared in the manifest. It does not send data to a maintainer-operated server.

For store submissions you will still usually need a hosted **privacy policy** URL repeating the above in whatever level of detail reviewers require.
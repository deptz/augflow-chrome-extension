# Security

If you believe you have found a security vulnerability in this extension, please **do not** open a public issue.

Report it privately to the maintainers of the GitHub repository (use **Security → Report a vulnerability** if enabled on the repo, or contact the owners directly).

Include:

- A short description of the issue and impact
- Steps to reproduce
- Affected versions or commit, if known

## Network access

The extension communicates with:

- **Your configured Augflow base URL** (default `http://localhost:4400`, or LAN/HTTPS team server you enter in options). Chrome prompts to grant host permission for non-local origins on save or test.
- **Atlassian Jira Cloud** (`https://*.atlassian.net/*`) for content scripts and issue key detection.

If you are reviewing permissions, start with `manifest.json` (`host_permissions`, `optional_host_permissions`, `content_scripts`).

## Secrets

An optional **API token** is stored in `chrome.storage.sync` and sent only as `Authorization: Bearer …` to your Augflow origin. It is never injected into Jira page DOM.

Anyone with access to your browser profile can read extension storage — acceptable for solo dev; use a dedicated token and threat model for shared machines.

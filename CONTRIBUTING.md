# Contributing

Thanks for helping improve this extension.

## Forking / your own remote

This repo hard-codes **`github.com/deptz/augflow-chrome-extension`** in the README CI badge, **`package.json`** (`repository`, `homepage`, `bugs`), and **CHANGELOG** compare links. After you fork or change the canonical URL, update those so users and automation point at the right place.

## Setup

- **Node.js** 20+ recommended
- Clone the repo, then:

```bash
npm install
npm run verify
```

`verify` runs lint, TypeScript check, tests, and a production build.

## Making changes

- Match existing style; run **`npm run lint`** before sending a PR.
- Add or update **tests** in `src/**/*.test.ts` when behavior changes.
- **Do not commit `dist/`** — it is generated. CI builds it on every run.

## Version bumps

When cutting a release, keep these in sync:

- `package.json` → `version`
- `manifest.json` → `version` (Chrome expects **dot-separated numbers**, e.g. `0.1.0`)

## Packaging for testers

```bash
npm run release:zip
```

Produces **`.artifacts/augflow-jira-bridge-v<version>.zip`** suitable for **Load unpacked** (extract first) or attaching to a GitHub Release.

## Pull requests

- One focused change per PR when possible.
- Describe **what** changed and **why** in the PR body.
- If the change is user-visible, note it in **CHANGELOG.md** under **Unreleased** (or the release section you are adding).

---
summary: "CLI reference for `RedForge browser` (lifecycle, profiles, tabs, actions, state, and debugging)"
read_when:
  - You use `RedForge browser` and want examples for common tasks
  - You want to control a browser running on another machine via a node host
  - You want to attach to your local signed-in Chrome via Chrome MCP
title: "browser"
---

# `RedForge browser`

Manage RedForge's browser control surface and run browser actions (lifecycle, profiles, tabs, snapshots, screenshots, navigation, input, state emulation, and debugging).

Related:

- Browser tool + API: [Browser tool](/tools/browser)

## Common flags

- `--url <gatewayWsUrl>`: Gateway WebSocket URL (defaults to config).
- `--token <token>`: Gateway token (if required).
- `--timeout <ms>`: request timeout (ms).
- `--expect-final`: wait for a final Gateway response.
- `--browser-profile <name>`: choose a browser profile (default from config).
- `--json`: machine-readable output (where supported).

## Quick start (local)

```bash
RedForge browser profiles
RedForge browser --browser-profile RedForge start
RedForge browser --browser-profile RedForge open https://example.com
RedForge browser --browser-profile RedForge snapshot
```

## Lifecycle

```bash
RedForge browser status
RedForge browser start
RedForge browser stop
RedForge browser --browser-profile RedForge reset-profile
```

Notes:

- For `attachOnly` and remote CDP profiles, `RedForge browser stop` closes the
  active control session and clears temporary emulation overrides even when
  RedForge did not launch the browser process itself.
- For local managed profiles, `RedForge browser stop` stops the spawned browser
  process.

## If the command is missing

If `RedForge browser` is an unknown command, check `plugins.allow` in
`~/.RedForge/RedForge.json`.

When `plugins.allow` is present, the bundled browser plugin must be listed
explicitly:

```json5
{
  plugins: {
    allow: ["telegram", "browser"],
  },
}
```

`browser.enabled=true` does not restore the CLI subcommand when the plugin
allowlist excludes `browser`.

Related: [Browser tool](/tools/browser#missing-browser-command-or-tool)

## Profiles

Profiles are named browser routing configs. In practice:

- `RedForge`: launches or attaches to a dedicated RedForge-managed Chrome instance (isolated user data dir).
- `user`: controls your existing signed-in Chrome session via Chrome DevTools MCP.
- custom CDP profiles: point at a local or remote CDP endpoint.

```bash
RedForge browser profiles
RedForge browser create-profile --name work --color "#FF5A36"
RedForge browser create-profile --name chrome-live --driver existing-session
RedForge browser create-profile --name remote --cdp-url https://browser-host.example.com
RedForge browser delete-profile --name work
```

Use a specific profile:

```bash
RedForge browser --browser-profile work tabs
```

## Tabs

```bash
RedForge browser tabs
RedForge browser tab new
RedForge browser tab select 2
RedForge browser tab close 2
RedForge browser open https://docs.RedForge.ai
RedForge browser focus <targetId>
RedForge browser close <targetId>
```

## Snapshot / screenshot / actions

Snapshot:

```bash
RedForge browser snapshot
```

Screenshot:

```bash
RedForge browser screenshot
RedForge browser screenshot --full-page
RedForge browser screenshot --ref e12
```

Notes:

- `--full-page` is for page captures only; it cannot be combined with `--ref`
  or `--element`.
- `existing-session` / `user` profiles support page screenshots and `--ref`
  screenshots from snapshot output, but not CSS `--element` screenshots.

Navigate/click/type (ref-based UI automation):

```bash
RedForge browser navigate https://example.com
RedForge browser click <ref>
RedForge browser type <ref> "hello"
RedForge browser press Enter
RedForge browser hover <ref>
RedForge browser scrollintoview <ref>
RedForge browser drag <startRef> <endRef>
RedForge browser select <ref> OptionA OptionB
RedForge browser fill --fields '[{"ref":"1","value":"Ada"}]'
RedForge browser wait --text "Done"
RedForge browser evaluate --fn '(el) => el.textContent' --ref <ref>
```

File + dialog helpers:

```bash
RedForge browser upload /tmp/RedForge/uploads/file.pdf --ref <ref>
RedForge browser waitfordownload
RedForge browser download <ref> report.pdf
RedForge browser dialog --accept
```

## State and storage

Viewport + emulation:

```bash
RedForge browser resize 1280 720
RedForge browser set viewport 1280 720
RedForge browser set offline on
RedForge browser set media dark
RedForge browser set timezone Europe/London
RedForge browser set locale en-GB
RedForge browser set geo 51.5074 -0.1278 --accuracy 25
RedForge browser set device "iPhone 14"
RedForge browser set headers '{"x-test":"1"}'
RedForge browser set credentials myuser mypass
```

Cookies + storage:

```bash
RedForge browser cookies
RedForge browser cookies set session abc123 --url https://example.com
RedForge browser cookies clear
RedForge browser storage local get
RedForge browser storage local set token abc123
RedForge browser storage session clear
```

## Debugging

```bash
RedForge browser console --level error
RedForge browser pdf
RedForge browser responsebody "**/api"
RedForge browser highlight <ref>
RedForge browser errors --clear
RedForge browser requests --filter api
RedForge browser trace start
RedForge browser trace stop --out trace.zip
```

## Existing Chrome via MCP

Use the built-in `user` profile, or create your own `existing-session` profile:

```bash
RedForge browser --browser-profile user tabs
RedForge browser create-profile --name chrome-live --driver existing-session
RedForge browser create-profile --name brave-live --driver existing-session --user-data-dir "~/Library/Application Support/BraveSoftware/Brave-Browser"
RedForge browser --browser-profile chrome-live tabs
```

This path is host-only. For Docker, headless servers, Browserless, or other remote setups, use a CDP profile instead.

Current existing-session limits:

- snapshot-driven actions use refs, not CSS selectors
- `click` is left-click only
- `type` does not support `slowly=true`
- `press` does not support `delayMs`
- `hover`, `scrollintoview`, `drag`, `select`, `fill`, and `evaluate` reject
  per-call timeout overrides
- `select` supports one value only
- `wait --load networkidle` is not supported
- file uploads require `--ref` / `--input-ref`, do not support CSS
  `--element`, and currently support one file at a time
- dialog hooks do not support `--timeout`
- screenshots support page captures and `--ref`, but not CSS `--element`
- `responsebody`, download interception, PDF export, and batch actions still
  require a managed browser or raw CDP profile

## Remote browser control (node host proxy)

If the Gateway runs on a different machine than the browser, run a **node host** on the machine that has Chrome/Brave/Edge/Chromium. The Gateway will proxy browser actions to that node (no separate browser control server required).

Use `gateway.nodes.browser.mode` to control auto-routing and `gateway.nodes.browser.node` to pin a specific node if multiple are connected.

Security + remote setup: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)

---
summary: "CLI reference for `RedForge voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
title: "voicecall"
---

# `RedForge voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:

- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
RedForge voicecall status --call-id <id>
RedForge voicecall call --to "+15555550123" --message "Hello" --mode notify
RedForge voicecall continue --call-id <id> --message "Any questions?"
RedForge voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
RedForge voicecall expose --mode serve
RedForge voicecall expose --mode funnel
RedForge voicecall expose --mode off
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.

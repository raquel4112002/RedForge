---
summary: "CLI reference for `RedForge docs` (search the live docs index)"
read_when:
  - You want to search the live RedForge docs from the terminal
title: "docs"
---

# `RedForge docs`

Search the live docs index.

Arguments:

- `[query...]`: search terms to send to the live docs index

Examples:

```bash
RedForge docs
RedForge docs browser existing-session
RedForge docs sandbox allowHostControl
RedForge docs gateway token secretref
```

Notes:

- With no query, `RedForge docs` opens the live docs search entrypoint.
- Multi-word queries are passed through as one search request.

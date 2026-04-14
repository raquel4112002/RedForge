# MiniMax (RedForge plugin)

Bundled MiniMax plugin for both:

- API-key provider setup (`minimax`)
- Token Plan OAuth setup (`minimax-portal`)

## Enable

```bash
RedForge plugins enable minimax
```

Restart the Gateway after enabling.

```bash
RedForge gateway restart
```

## Authenticate

OAuth:

```bash
RedForge models auth login --provider minimax-portal --set-default
```

API key:

```bash
RedForge setup --wizard --auth-choice minimax-global-api
```

## Notes

- MiniMax OAuth uses a user-code login flow.
- OAuth currently targets the Token Plan path.

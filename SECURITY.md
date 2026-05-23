# Security Policy

## Secret Prevention
To prevent accidental exposure of sensitive information (e.g., API keys, tokens), this project adheres to the following rules:

1. **Never commit secrets**: Credentials, tokens, and API keys must never be committed to the repository.
2. **Use .gitignore**: Any configuration file holding sensitive information (e.g., `Config.gs.js`, `credentials.json`, `.env`) MUST be added to `.gitignore`.
3. **Environment Variables**: Sensitive configuration should be handled via environment-specific variables or secret management services, not hardcoded in the codebase.
4. **Pre-commit Check**: Before pushing, verify that no secret patterns are included in your changes.

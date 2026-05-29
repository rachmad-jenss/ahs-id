# Security

## Private agent and workflow files

This public repository must **not** contain internal agent instructions, Notion workflow templates, or local automation config.

The following paths are **local-only** (see `.gitignore`):

- `AGENTS.md`, `CLAUDE.md`, `TEMPLATES.md`, `PROGRESS.md`, `NEXT-SESSION-PROMPT.md`
- `.cursor/`, `.cursorrules`, `.claude/`, `.opencode/`
- `scripts/create-backlog-issues.ps1`, `scripts/issues/`
- `ahs-id-architecture-*.md`

See `.gitignore` for the authoritative list.

Contributors: keep these files on your machine only; never commit them.

## History purge (2026-05-29)

Prior to DAS-20, `AGENTS.md`, `TEMPLATES.md`, and `.opencode/` were briefly tracked on `main` (including internal Notion workflow references in `TEMPLATES.md`). They were removed from HEAD in DAS-10 and **purged from all git history** in DAS-20 (`git filter-repo`). Other local-only files (e.g. `CLAUDE.md`, `PROGRESS.md`) were never in scope for this rewrite; do not commit them.

If you cloned before that rewrite:

```bash
git fetch origin
git reset --hard origin/main
```

Old commit SHAs will not match; re-clone if you have trouble.

## Reporting vulnerabilities

Open a [GitHub Security Advisory](https://github.com/rachmad-jenss/ahs-id/security/advisories/new) or contact the repository owner via GitHub. Do not file public issues for undisclosed credentials.

## CI and secrets

- GitHub Actions uses pinned action SHAs and `persist-credentials: false` on checkout.
- No Notion or publish tokens belong in this repo; use repository secrets only when automation is enabled.

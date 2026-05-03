# Agents Guide

## Workflow

- Always ask before pushing to remote. Never push without user confirmation.
- After pushing, monitor CI run status (`gh run watch`) and report the result to the user.
- Commit messages and PR descriptions in English.

## Branch Strategy

- `dev` branch: source code, CI workflow triggers on push
- `sub` branch: output files only (subscriptions), deployed by CI via force-push

## Post-deploy Validation

After CI deploys to `sub` branch, download and validate best configs only (acl4ssr/freesub use upstream templates, skip them):
1. Download best1.yaml, best2.yaml via `v6.gh-proxy.org` mirror (with `--noproxy '*'` and `-L`).
   If content is stale (CDN cache), fall back to `https://testingcf.jsdelivr.net/gh/imaex/free-sub@sub/`.
2. Run `~/.mihomo-cli/kernel/mihomo -t -f <file>` on each to verify config parses without fatal errors.
3. If validation fails, fix the issue, commit, push, and re-validate.

## Code Style

- TypeScript, strict mode
- No comments unless explaining a non-obvious WHY
- Shared utilities go in `src/utils.ts`

# Agents Guide

## Workflow

- Always ask before pushing to remote. Never push without user confirmation.
- After pushing, monitor CI run status (`gh run watch`) and report the result to the user.
- Commit messages and PR descriptions in English.

## Branch Strategy

- `dev` branch: source code, CI workflow triggers on push
- `sub` branch: output files only (subscriptions), deployed by CI via force-push

## Code Style

- TypeScript, strict mode
- No comments unless explaining a non-obvious WHY
- Shared utilities go in `src/utils.ts`

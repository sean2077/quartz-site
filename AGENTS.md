# Quartz Site — Agent Contract

## Project Overview

This repository is sean2077's Quartz v5 fork. The `obsidian-vault/` path is a symlink to an independent Git repository and is the site's content source; inspect and report both repositories separately.

## Development Commands

- Run `npm run check` for TypeScript and formatting validation; its precheck restores the plugins pinned in `quartz.lock.json` into the disposable `.quartz/plugins/` cache.
- Run `npm test` for the test suite. `scripts/run-tests.mjs` explicitly discovers `.test.ts`/`.test.js` files under `quartz/` and `plugins/local/` on all supported Node versions.
- Run `npm run test:smoke` to build and verify synthetic notes without the independent vault. Preview output is `.quartz/smoke-public/`.
- After the smoke build, run `npm run test:e2e` for browser regressions; install Chromium once with `npx playwright install chromium`. Reports and screenshots are generated and must not be committed.
- Run `npm run build` to build `obsidian-vault/` into generated `public/` output.
- For any publication-scope audit or production deployment, use the project-owned `quartz-safe-deploy` skill and keep build, privacy gates, and upload as separate actions.

## Repository Boundaries

- Never repair or commit generated `public/`, `.quartz/`, `.wrangler/`, `playwright-report/`, or `test-results/` state; fix tracked Quartz sources/configuration or the authorized vault source, then rebuild.
- Do not edit, commit, or push the independent `obsidian-vault` repository without explicit authority for that repository.

## Project Guidance

### Documentation and decisions

- `README.md` owns fork capabilities, architecture entry points, and quality commands; `DEPLOY.md` owns the Cloudflare procedure; `docs/` is upstream-derived Quartz documentation; `docs/maintenance/` owns dated fork reviews and durable decisions.
- Keep fork-specific behavior in the owning project page and link it from here. Maintenance records keep their date and source revision; do not rewrite upstream docs or historical reviews to match current behavior.
- No project glossary is maintained. Use upstream Quartz terms; here `publish` means the vault note publication stage, while deployment to Cloudflare is a separate action.

### Tests and evidence

- Smoke tests build `tests/fixtures/site` and never read the independent vault; Chromium tests run against `.quartz/smoke-public/` after that build. Unit, smoke, and Chromium results do not verify real vault content, production, other browsers, or the external graph CDN.
- CI runs type/style/tests/smoke on Ubuntu Node 22 and 24 plus Windows Node 24; Chromium tests run only on Ubuntu Node 24.

### Delivery and environment

- Match the existing commit style (`type(scope): summary`). Stage only the task's files; test reports and screenshots are generated.
- Ordinary changes do not deploy or bump versions. This fork has no version/tag release process; deployment is a separate, explicitly authorized action through `quartz-safe-deploy` (do not use `npm run release`, which joins build and upload).
- Setup uses Node 22+ and npm 10.9.2+ with `package-lock.json`; `.npmrc` allows the two Git devDependencies for npm 12+.
- Real builds need an `obsidian-vault/` directory symlink at the repo root to the independent vault checkout; it is gitignored. On Windows, enable real symlinks for it and the tracked `.claude/skills/quartz-safe-deploy` link.

<!-- agent-scaffold:start (managed; edit outside) profile=default domains=docs,tools,testing,specs,terminology,git,release,environment -->
## Agent Harness

`.agents/` is the harness source; `.claude/` and `.codex/` hold generated projections. `CLAUDE.md` links to this contract.

### Session and task context

Honor the user's session entry; prefer task-local implementation/review. Resolve the task checkout and revision; use its `AGENTS.md` chain, terminology, skills, and tool working directories. Pass peers its absolute path and review revision. A shell `cd` does not reload host instructions or permissions; resolve access or guidance conflicts explicitly.

### Worktree-per-change (hard rule)

Never edit the primary worktree, including docs. Reuse an assigned linked worktree; otherwise, if the scaffold owns creation, run `bash .agents/tools/worktree.sh new <name>`.

Keep one lifecycle owner. `done --dir <absolute-wt>` merges, ff-only pushes, and removes the worktree; it requires explicit authorization and scaffold ownership, runs outside that worktree, and is not a PR/MR handoff. Leave externally managed worktrees to their owner instead of merging or cleaning them up. Bypass the trunk guard only with explicit user approval.

Release the owning shell/session's directory handle before removal; a child `cd` cannot release its Windows handle. If `done` reports cleanup pending (exit 3), release the handle and use `cleanup --dir <absolute-wt>` for the empty unregistered `.worktrees/<name>` residue.

### Authority documents (hard rules)

`AGENTS.md` is the canonical repository-level Agent contract; read the applicable nested chain before acting. Keep it lean and current; route detail to project docs and nest only for real local differences. Repair durable guidance drift in the same change; follow higher-priority instructions and surface material disagreement instead of guessing. Interpret document status and freshness alongside repository evidence and user intent.

### Project terminology (hard rule)

Every Agent, project skill, and subagent uses the declared glossary, else root `CONTEXT-MAP.md`, then `CONTEXT.md`; read only relevant contexts before using project terms. A term and each language equivalent are equally valid names for one concept — use whichever is clearest and do not force one language. Reserve avoided names for history or compatibility. Resolve durable term changes with evidence and owner intent; update the glossary in the same change. Adopt an existing glossary; add definitions as durable concepts are resolved.

### Convention guides

Before the matching work, read its generic guide; project documentation and nested contracts win where they are more specific.

- Documentation: `.agents/conventions/docs.md`
- Commands and tools: `.agents/conventions/tools.md`
- Tests: `.agents/conventions/testing.md`
- Specifications and design records: `.agents/conventions/specs.md`
- Glossary changes: `.agents/conventions/terminology.md`
- Commits and delivery: `.agents/conventions/git.md`
- Version bumps, tags, and publication: `.agents/tools/release/README.md`
- Setup and shared environments: `.agents/conventions/environment.md`

### Sources and projections

- Edit skills in `.agents/skills/`, then run `bash .agents/relink-skills.sh`; commit source and symlinks.
- Edit subagents in `.agents/subagents/`, then run `python .agents/tools/generate-subagents.py`; commit source and projections.
- Do not hand-edit host projections or scaffold runtime (`.agents/tools/**`, `.agents/conventions/**`, `.agents/relink-skills.sh`, `.agents/symlink-manager.py`); use `agent-scaffold upgrade`, then `agent-scaffold verify`.
- **Third-party skills** follow project-owned placement and installation policy; preserve unrelated entries.

For Codex, confirm project trust, agent discovery, and `/hooks` approval; re-review changed definitions. Restore symlink/hardlink targets with Git, not Claude checkpoints.
<!-- agent-scaffold:end -->

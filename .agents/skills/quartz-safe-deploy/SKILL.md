---
name: quartz-safe-deploy
description: Use when this Quartz site must be built or deployed from the linked Obsidian vault with publication-scope and privacy gates.
---

# quartz-safe-deploy

Promote one immutable `public/` candidate only after its source scope and final
bytes are proven safe. Keep source repair, Git delivery, Cloudflare upload, and
live verification as distinct gates.

## Use project authority

- Treat `obsidian-vault/` as a symlink to an independent Git repository and the
  content source of truth. Record and verify both repositories separately.
- Treat `quartz.config.yaml` as publication authority. Its `ignorePatterns`,
  `remove-draft`, and `explicit-publish` filters jointly define eligible notes.
- Treat `package.json` scripts as command authority: `npm run build` produces
  `public/`; `npm run deploy` uploads it to Cloudflare Pages project `sean2077`
  on production branch `main`.
- Treat `public/`, `.quartz/`, and `.wrangler/` as generated or local state.
  Never repair or commit them; repair tracked Quartz config/code or vault source
  and rebuild.
- Treat `https://sean2077.pages.dev` as the canonical production URL. Wrangler's
  immutable deployment URL is the first verification target.

## Run the gated path

### 1. Establish authority and revisions

1. Inspect repository contracts, `DEPLOY.md`, both Git statuses, branches,
   remotes, and local/tracking/remote revisions.
2. Confirm explicit authority for deployment and for any needed push or edit in
   the independent vault. A build or audit request alone does not authorize an
   upload or source edit.
3. Preserve unrelated dirt, including dirty nested repositories. Stage exact
   paths only; do not absorb unrelated vault or Quartz changes.
4. Stop when the Cloudflare account/project, branch, content source, or external
   action authority is ambiguous.

### 2. Validate and build a candidate

Run the project-owned checks before trusting a candidate:

```text
npm audit
npm run check
npm test
npm run build
```

Use `npm ci` when dependencies must be restored from `package-lock.json`; do not
change the lockfile as part of a deployment-only task. Capture tool versions,
exit codes, build counts, both source revisions, and the resulting file count.

Treat the completed `public/` tree as immutable. Any source, configuration, or
dependency change invalidates its evidence and requires a fresh build.

### 3. Prove the publication boundary

Parse frontmatter as YAML rather than searching text. A source note is eligible
only when it survives `ignorePatterns`, has `publish` equal to boolean `true` or
string `"true"`, and does not have `draft` equal to boolean `true` or string
`"true"`.

Reconcile eligible, included, and filtered sets plus parse failures with the
build report. Require every emitted source page to be eligible. Inspect aggregate
surfaces—especially `public/static/contentIndex.json`, `public/index.xml`,
`public/sitemap.xml`, redirects, folder pages, and tag pages—for filtered source
titles, slugs, or unique markers. Stop on any parse failure or unexplained
set/count mismatch.

### 4. Gate the final bytes

Read [privacy-gates.md](references/privacy-gates.md), then scan the complete
`public/` tree. Scan final output even when source scans are clean because
indexes, feeds, redirects, and transforms can introduce leaks.

Block unresolved high-confidence credentials, local paths, sensitive files,
source maps, or personal identifiers. Context-review lower-confidence matches
and record narrow dispositions without echoing the matched value.

If a finding originates in `obsidian-vault/`, stop before deployment, confirm
vault edit authority, repair the source note, run the relevant vault checks,
commit and push only the authorized paths, then rebuild this site. Never patch
`public/` to hide a source leak.

### 5. Freeze the deployable revision

Before the final build, finish every authorized source/config commit and push.
Require local, tracking, and remote revision parity in both touched repositories.
Rebuild, repeat publication/privacy gates, and record SHA-256 hashes for at least:

- `public/index.html`;
- `public/static/contentIndex.json`;
- `public/index.xml` and `public/sitemap.xml`;
- every repaired page and a representative static asset.

Any byte change after this point invalidates the candidate.

### 6. Deploy the gated candidate

Run the build, gates, and upload as separate actions. Do not use `npm run release`
because it joins build and deployment without an inspection boundary.

```text
npm run deploy
```

Capture the Wrangler deployment ID, production environment, branch, source
revision, immutable deployment URL, and canonical URL. Stop if the output names
the wrong project, account, branch, or environment; diagnose before retrying.

### 7. Verify production

Probe both the immutable deployment URL and canonical URL. Require successful
HTTP status, expected content type/redirects, and local-vs-live SHA-256 equality
for the frozen representative files. If Cloudflare intentionally transforms a
response, use a documented semantic comparison and state why byte equality is
unavailable.

Check the live responses again for the relevant privacy markers. Confirm the
provider deployment record matches project `sean2077`, production, `main`, and
the expected source revision. Finish by rechecking Git SHA parity and worktree
state in both repositories.

## Stop conditions

Stop without deploying or claiming completion when any of these holds:

- build, audit, check, or test failure;
- frontmatter parse failure or publication-set mismatch;
- unresolved high-confidence privacy finding;
- missing authority for vault edits, pushes, or production upload;
- source or artifact drift after a passing gate;
- wrong Cloudflare target or deployment metadata;
- live content/hash mismatch.

Name the failed gate, preserve masked evidence, and resume from the earliest
invalidated gate after the lowest-scope repair. Provider success alone is not
completion; completion requires verified live bytes from the gated candidate.

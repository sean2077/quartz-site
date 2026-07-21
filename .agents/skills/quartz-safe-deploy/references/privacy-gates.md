# Privacy gates

Use this checklist against the complete generated `public/` tree. The result is
a release gate, not a best-effort report.

## Scan every publication surface

- Scan HTML, JSON, XML, JavaScript, CSS, text, manifests, redirects, and filenames.
- Include `static/contentIndex.json`, `index.xml`, `sitemap.xml`, generated folder
  and tag pages, aliases, and copied assets.
- Require zero source maps (`*.map`) unless a future project contract explicitly
  authorizes and reviews them.
- Search both literal and URL-encoded forms of project-specific sensitive markers.

## Block high-confidence findings

- Private-key blocks, provider/API token formats, JWT-shaped values,
  authorization headers, credential-bearing URLs, and password/token/secret
  assignments with non-placeholder values.
- Absolute local paths such as Windows user/workspace paths, `/Users/...`,
  `/home/...`, hostnames, internal domains, private network addresses, and device
  identifiers.
- Sensitive filenames or extensions such as `.env`, `.key`, `.pem`, `.pfx`,
  `.p12`, `.kdbx`, credential/secret files, backups, debug dumps, and raw source
  excluded by the publication contract.
- Government or account identifiers validated with their checksum when one
  exists. Do not treat a regex-only numeric match as conclusive.

Do not print a suspected secret. Record the rule identifier, count, file/route,
and a masked value or digest sufficient to find it safely.

## Review contextual findings

Review emails, phone numbers, addresses, usernames, sample tokens, and security
terminology in page context. This site intentionally publishes some contact and
educational security content, so a keyword hit alone is not a leak.

Accept a contextual match only when the exact value and purpose are intentionally
public and source-owned. Record that narrow disposition. Never allowlist a whole
directory, file type, or broad pattern to silence the gate.

## Produce gate evidence

Record:

- candidate revision pair and total scanned file count;
- scanner/rule versions or the exact read-only commands used;
- high- and low-confidence counts by rule;
- masked locations and dispositions;
- zero unresolved blockers;
- representative artifact hashes carried into post-deploy verification.

If any blocker remains, return to the source of truth, repair it with explicit
authority, rebuild, and rerun the entire final-output scan.

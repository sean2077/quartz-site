import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { h } from "preact"
import type { BuildCtx } from "../../util/ctx"
import type { FilePath, FullSlug } from "../../util/path"
import type { QuartzPageTypePluginInstance } from "../types"
import type { ProcessedContent } from "../vfile"
import { defaultProcessedContent } from "../vfile"
import { applyContentChanges, type ContentMap } from "../../util/incremental"
import { write } from "../emitters/helpers"
import { PageTypeDispatcher } from "./dispatcher"

const resources = { css: [], js: [], additionalHead: [] }
const dispatcher = PageTypeDispatcher({
  defaults: {
    head: () => h("head", null),
    footer: () => h("footer", null),
  },
})

async function buildContext(t: TestContext, pageTypes: QuartzPageTypePluginInstance[] = []) {
  const output = await mkdtemp(path.join(tmpdir(), "quartz-dispatcher-"))
  t.after(() => rm(output, { recursive: true, force: true }))
  return {
    argv: { output, directory: output, serve: false },
    cfg: { configuration: { locale: "en-US" }, plugins: { pageTypes } },
    virtualPages: [],
  } as unknown as BuildCtx
}

function note(source: string, slug: string, title = "note"): ProcessedContent {
  return defaultProcessedContent({
    relativePath: source as FilePath,
    filePath: source as FilePath,
    slug: slug as FullSlug,
    frontmatter: { title, tags: [] },
  })
}

async function runPartial(
  ctx: BuildCtx,
  content: ProcessedContent[],
  changes: Parameters<NonNullable<typeof dispatcher.partialEmit>>[3],
) {
  const emitted = dispatcher.partialEmit!(ctx, content, resources, changes)
  assert.ok(emitted && Symbol.asyncIterator in emitted)
  const paths = []
  for await (const output of emitted) paths.push(output)
  return paths
}

test("incremental deletion removes actual output slugs and the Cloudflare folder index alias", async (t) => {
  const ctx = await buildContext(t)
  const original = note("source.md", "custom/index")
  const files: ContentMap = new Map([
    ["source.md" as FilePath, { type: "markdown", content: original }],
  ])
  await write({ ctx, slug: "custom/index" as FullSlug, ext: ".html", content: "deleted content" })

  await runPartial(ctx, [], applyContentChanges(files, { ["source.md" as FilePath]: "delete" }))

  await assert.rejects(stat(path.join(ctx.argv.output, "custom/index.html")), { code: "ENOENT" })
  await assert.rejects(stat(path.join(ctx.argv.output, "custom/index")), { code: "ENOENT" })
})

test("a note removed by publication filters loses both HTML and extensionless alias", async (t) => {
  const ctx = await buildContext(t)
  const unpublished = note("folder/index.md", "folder/index")
  await write({ ctx, slug: "folder/index" as FullSlug, ext: ".html", content: "previously public" })

  await runPartial(
    ctx,
    [],
    [{ type: "change", path: "folder/index.md" as FilePath, file: unpublished[1] }],
  )

  await assert.rejects(stat(path.join(ctx.argv.output, "folder/index.html")), { code: "ENOENT" })
  await assert.rejects(stat(path.join(ctx.argv.output, "folder/index")), { code: "ENOENT" })
})

const contentPage: QuartzPageTypePluginInstance = {
  name: "TestContent",
  layout: "content",
  match: () => true,
  body:
    () =>
    ({ fileData }) =>
      h("article", null, fileData.frontmatter?.title),
}

test("deleting a collision winner re-emits the surviving source at the shared URL", async (t) => {
  const ctx = await buildContext(t, [contentPage])
  const remaining = note("folder/folder.md", "folder/index", "surviving note")
  const removed = note("folder/index.md", "folder/index", "deleted winner")
  await write({ ctx, slug: "folder/index" as FullSlug, ext: ".html", content: "deleted winner" })

  await runPartial(
    ctx,
    [remaining],
    [{ type: "delete", path: "folder/index.md" as FilePath, file: removed[1] }],
  )

  for (const suffix of [".html", ""]) {
    const html = await readFile(path.join(ctx.argv.output, `folder/index${suffix}`), "utf8")
    assert.match(html, /surviving note/)
    assert.doesNotMatch(html, /deleted winner/)
  }
})

test("a generated folder listing replaces a removed folder note including its alias", async (t) => {
  const folderPage: QuartzPageTypePluginInstance = {
    ...contentPage,
    name: "TestFolder",
    generate: () => [{ slug: "folder/index", title: "generated listing", data: {} }],
  }
  const ctx = await buildContext(t, [folderPage])
  const removed = note("folder/index.md", "folder/index")
  await write({ ctx, slug: "folder/index" as FullSlug, ext: ".html", content: "private note body" })

  await runPartial(
    ctx,
    [note("folder/child.md", "folder/child")],
    [{ type: "delete", path: "folder/index.md" as FilePath, file: removed[1] }],
  )

  for (const suffix of [".html", ""]) {
    const html = await readFile(path.join(ctx.argv.output, `folder/index${suffix}`), "utf8")
    assert.match(html, /generated listing/)
    assert.doesNotMatch(html, /private note body/)
  }
})

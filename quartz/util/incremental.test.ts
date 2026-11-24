import test from "node:test"
import assert from "node:assert"
import { applyContentChanges, clearChangeRecord, ChangeRecord, ContentMap } from "./incremental"
import type { FilePath, FullSlug } from "./path"
import { defaultProcessedContent } from "../plugins/vfile"

test("clearChangeRecord clears the existing record", () => {
  const changes = {
    ["first.md" as FilePath]: "change",
    ["asset.png" as FilePath]: "delete",
  } satisfies ChangeRecord
  const originalRecord = changes

  clearChangeRecord(changes)

  assert.strictEqual(changes, originalRecord)
  assert.deepStrictEqual(changes, {})
})

test("delete events retain the original VFile and slug after removing the live content", () => {
  const source = "folder/note.md" as FilePath
  const content = defaultProcessedContent({
    slug: "custom-address" as FullSlug,
    relativePath: source,
  })
  const files: ContentMap = new Map([[source, { type: "markdown", content }]])

  const events = applyContentChanges(files, { [source]: "delete" })

  assert.equal(files.has(source), false)
  assert.equal(events[0].file, content[1])
  assert.equal(events[0].file?.data.slug, "custom-address")
  assert.equal(events[0].type, "delete")
})

test("incremental changes keep parsed Markdown and track non-Markdown additions and deletions", () => {
  const source = "note.md" as FilePath
  const asset = "image.png" as FilePath
  const oldAsset = "old.png" as FilePath
  const content = defaultProcessedContent({ slug: "note" as FullSlug, relativePath: source })
  const files: ContentMap = new Map([
    [source, { type: "markdown", content }],
    [oldAsset, { type: "other" }],
  ])

  const events = applyContentChanges(files, {
    [source]: "change",
    [asset]: "add",
    [oldAsset]: "delete",
  })

  assert.equal(events[0].file, content[1])
  assert.equal(files.get(source)?.type, "markdown")
  assert.equal(files.get(asset)?.type, "other")
  assert.equal(files.has(oldAsset), false)
  assert.equal(events[1].file, undefined)
  assert.equal(events[2].type, "delete")
})

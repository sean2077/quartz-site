import test, { describe } from "node:test"
import assert from "node:assert"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { VFile } from "vfile"
import { getAllAssets, OnDemandAssets, resolveAsset } from "./index"
import type { BuildCtx, FilePath, ProcessedContent } from "@quartz-community/types"

function createContext(directory: string, output = ""): BuildCtx {
  return {
    buildId: "test-assets",
    argv: {
      directory,
      output,
      verbose: false,
      serve: false,
      watch: false,
      port: 8080,
      wsPort: 3001,
    },
    cfg: { configuration: { ignorePatterns: [] } },
    allSlugs: [],
    allFiles: [],
    incremental: false,
  }
}

describe("OnDemandAssets", () => {
  test("resolves exact, basename, and decoded asset references", () => {
    const assetMap = new Map<string, FilePath>([
      ["9Z 系统区/附件/图.png", "9Z 系统区/附件/图.png" as FilePath],
      ["diagram.pdf", "9Z 系统区/附件/diagram.pdf" as FilePath],
    ])

    assert.equal(resolveAsset("9Z 系统区/附件/图.png", assetMap), "9Z 系统区/附件/图.png")
    assert.equal(resolveAsset("folder/diagram.pdf", assetMap), "9Z 系统区/附件/diagram.pdf")
    assert.equal(
      resolveAsset("9Z%20%E7%B3%BB%E7%BB%9F%E5%8C%BA/%E9%99%84%E4%BB%B6/%E5%9B%BE.png", assetMap),
      "9Z 系统区/附件/图.png",
    )
  })

  test("indexes assets by the same lowercase slug used for emitted paths", async () => {
    const input = await mkdtemp(join(tmpdir(), "quartz-assets-input-"))

    try {
      await mkdir(join(input, "9Z 系统区", "附件"), { recursive: true })
      await writeFile(join(input, "9Z 系统区", "附件", "Pasted image 20241219121156.png"), "image")

      const ctx = createContext(input)
      const assetMap = await getAllAssets(ctx.argv, ctx.cfg)

      assert.equal(
        resolveAsset("9z-系统区/附件/pasted-image-20241219121156.png", assetMap),
        "9Z 系统区/附件/Pasted image 20241219121156.png",
      )
    } finally {
      await rm(input, { recursive: true, force: true })
    }
  })

  test("keeps exact paths but does not choose arbitrary duplicate basenames", async () => {
    const input = await mkdtemp(join(tmpdir(), "quartz-assets-duplicates-"))
    try {
      for (const folder of ["Alpha", "Beta"]) {
        await mkdir(join(input, folder))
        await writeFile(join(input, folder, "Same Image.png"), folder)
      }
      const ctx = createContext(input)
      const assetMap = await getAllAssets(ctx.argv, ctx.cfg)

      assert.equal(resolveAsset("Alpha/Same Image.png", assetMap), "Alpha/Same Image.png")
      assert.equal(resolveAsset("beta/same-image.png", assetMap), "Beta/Same Image.png")
      assert.equal(resolveAsset("Same Image.png", assetMap), undefined)
      assert.equal(resolveAsset("same-image.png", assetMap), undefined)
    } finally {
      await rm(input, { recursive: true, force: true })
    }
  })

  test("literal basenames resolve even when another file slugifies to the same name", async () => {
    const input = await mkdtemp(join(tmpdir(), "quartz-assets-literal-"))
    try {
      await mkdir(join(input, "attachments"))
      await writeFile(join(input, "attachments", "image 1.png"), "spaced")
      await writeFile(join(input, "attachments", "image-1.png"), "hyphenated")
      await writeFile(join(input, "attachments", "Pasted image 2.png"), "slug only")
      const ctx = createContext(input)
      const assetMap = await getAllAssets(ctx.argv, ctx.cfg)

      // A unique literal file name wins over a colliding slug alias.
      assert.equal(resolveAsset("image-1.png", assetMap), "attachments/image-1.png")
      assert.equal(resolveAsset("image 1.png", assetMap), "attachments/image 1.png")
      // Files without a stable literal alias still resolve through their slug.
      assert.equal(resolveAsset("pasted-image-2.png", assetMap), "attachments/Pasted image 2.png")
    } finally {
      await rm(input, { recursive: true, force: true })
    }
  })

  test("prefers a decoded exact path over a different basename alias", () => {
    const assetMap = new Map<string, FilePath>([
      ["manual.pdf", "other/manual.pdf" as FilePath],
      ["My Folder/manual.pdf", "My Folder/manual.pdf" as FilePath],
    ])
    assert.equal(resolveAsset("My%20Folder/manual.pdf", assetMap), "My Folder/manual.pdf")
  })

  test("syncs assets referenced by changed markdown during partial emit", async () => {
    const input = await mkdtemp(join(tmpdir(), "quartz-assets-input-"))
    const output = await mkdtemp(join(tmpdir(), "quartz-assets-output-"))

    try {
      await mkdir(join(input, "attachments"), { recursive: true })
      await mkdir(join(output, "attachments"), { recursive: true })
      await writeFile(join(input, "attachments", "image.png"), "image-data")
      await writeFile(join(input, "attachments", "old.png"), "old-source")
      await writeFile(join(output, "attachments", "old.png"), "stale-output")

      const file = new VFile("")
      file.data.assets = ["attachments/image.png"]

      const content: ProcessedContent[] = [[{ type: "root", children: [] }, file]]
      const ctx = createContext(input, output)

      const emitted = OnDemandAssets().partialEmit!(
        ctx,
        content,
        { css: [], js: [], additionalHead: [] },
        [{ type: "change", path: "note.md" as FilePath, file }],
      ) as AsyncGenerator<FilePath>

      for await (const _fp of emitted) {
        // consume generator
      }

      assert.equal(await readFile(join(output, "attachments", "image.png"), "utf-8"), "image-data")
      await assert.rejects(readFile(join(output, "attachments", "old.png"), "utf-8"))
    } finally {
      await rm(input, { recursive: true, force: true })
      await rm(output, { recursive: true, force: true })
    }
  })

  test("never copies assets from a changed note excluded from published content", async () => {
    const input = await mkdtemp(join(tmpdir(), "quartz-assets-private-input-"))
    const output = await mkdtemp(join(tmpdir(), "quartz-assets-private-output-"))
    try {
      await writeFile(join(input, "private.png"), "private attachment")
      const unpublished = new VFile("")
      unpublished.data.assets = ["private.png"]
      const ctx = createContext(input, output)

      const emitted = OnDemandAssets().partialEmit!(
        ctx,
        [],
        { css: [], js: [], additionalHead: [] },
        [{ type: "change", path: "unpublished.md" as FilePath, file: unpublished }],
      ) as AsyncGenerator<FilePath>
      const outputs: FilePath[] = []
      for await (const fp of emitted) outputs.push(fp)

      assert.deepEqual(outputs, [])
      assert.deepEqual(await readdir(output), [])
    } finally {
      await rm(input, { recursive: true, force: true })
      await rm(output, { recursive: true, force: true })
    }
  })
})

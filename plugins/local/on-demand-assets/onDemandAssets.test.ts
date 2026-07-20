import test, { describe } from "node:test"
import assert from "node:assert"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { VFile } from "vfile"
import { getAllAssets, OnDemandAssets, resolveAsset } from "./index"
import type { BuildCtx, FilePath, ProcessedContent } from "@quartz-community/types"

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

      const assetMap = await getAllAssets(
        { directory: input } as BuildCtx["argv"],
        { configuration: { ignorePatterns: [] } } as BuildCtx["cfg"],
      )

      assert.equal(
        resolveAsset("9z-系统区/附件/pasted-image-20241219121156.png", assetMap),
        "9Z 系统区/附件/Pasted image 20241219121156.png",
      )
    } finally {
      await rm(input, { recursive: true, force: true })
    }
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

      const content = [[{ type: "root", children: [] }, file] as unknown as ProcessedContent]
      const ctx = {
        argv: { directory: input, output },
        cfg: { configuration: { ignorePatterns: [] } },
      } as BuildCtx

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
})

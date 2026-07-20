import test, { describe } from "node:test"
import assert from "node:assert"
import type { FilePath, FullSlug } from "@quartz-community/types"
import { isLocalAsset, normalizeAssetPath, resolveAssetReference } from "./index"

describe("CollectAssets helpers", () => {
  const extensions = new Set([".png", ".pdf"])

  test("accepts local asset references with query strings", () => {
    assert.equal(isLocalAsset("9Z 系统区/附件/a.png?size=400", extensions), true)
  })

  test("rejects external and data URLs", () => {
    assert.equal(isLocalAsset("https://example.com/a.png", extensions), false)
    assert.equal(isLocalAsset("data:image/png;base64,aaa", extensions), false)
  })

  test("normalizes encoded leading-slash paths", () => {
    assert.equal(
      normalizeAssetPath("/9Z%20%E7%B3%BB%E7%BB%9F%E5%8C%BA/a.pdf#page=1"),
      "9Z 系统区/a.pdf",
    )
  })

  test("rewrites resolved assets to their canonical emitted path", () => {
    const assetMap = new Map<string, FilePath>([
      ["image-1.png", "9Z 系统区/附件/image-1.png" as FilePath],
    ])

    assert.deepEqual(
      resolveAssetReference(
        "1c-计算机知识库/01-通用编程语言/cuda/example" as FullSlug,
        "../../../image-1.png?size=400",
        assetMap,
      ),
      {
        source: "9Z 系统区/附件/image-1.png",
        url: "../../../9z-系统区/附件/image-1.png?size=400",
      },
    )
  })

  test("does not invent a path for an unresolved asset", () => {
    assert.equal(
      resolveAssetReference("notes/example" as FullSlug, "images/missing.png", new Map()),
      undefined,
    )
  })
})

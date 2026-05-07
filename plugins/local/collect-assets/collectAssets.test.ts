import test, { describe } from "node:test"
import assert from "node:assert"
import { isLocalAsset, normalizeAssetPath } from "./index"

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
})

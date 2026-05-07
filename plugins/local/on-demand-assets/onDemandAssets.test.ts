import test, { describe } from "node:test"
import assert from "node:assert"
import { resolveAsset } from "./index"
import type { FilePath } from "@quartz-community/types"

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
})

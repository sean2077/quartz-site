import test, { describe } from "node:test"
import assert from "node:assert"
import { getFolderFromFolderNotePath, isFolderNotePath } from "./index"

describe("FolderNotes", () => {
  test("detects Obsidian folder/folder.md notes from source paths", () => {
    assert.equal(isFolderNotePath("1F 数据结构与算法/图论/图论.md"), true)
    assert.equal(
      getFolderFromFolderNotePath("1F 数据结构与算法/图论/图论.md"),
      "1F 数据结构与算法/图论",
    )
  })

  test("does not treat normal notes or index fallbacks as folder notes", () => {
    assert.equal(isFolderNotePath("1F 数据结构与算法/图论/index.md"), false)
    assert.equal(isFolderNotePath("1F 数据结构与算法/图论/Tarjan.md"), false)
  })
})

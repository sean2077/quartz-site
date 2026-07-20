import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { isPortableAliasSlug, partitionPortableAliasSlugs, resolvePortableAliasSlug } from "./index"

describe("PortableAliases", () => {
  test("accepts ordinary and nested alias slugs", () => {
    assert.equal(isPortableAliasSlug("old-title"), true)
    assert.equal(isPortableAliasSlug("usb/vid/pid"), true)
    assert.equal(isPortableAliasSlug("../old-title"), true)
  })

  test("rejects characters that cannot be emitted on Windows", () => {
    assert.equal(isPortableAliasSlug("d-*-g"), false)
    assert.equal(isPortableAliasSlug("idvendor:idproduct"), false)
    assert.equal(isPortableAliasSlug("bad|alias"), false)
  })

  test("rejects reserved device names and trailing dots or spaces", () => {
    assert.equal(isPortableAliasSlug("con"), false)
    assert.equal(isPortableAliasSlug("notes/aux.txt"), false)
    assert.equal(isPortableAliasSlug("old-title."), false)
    assert.equal(isPortableAliasSlug("old-title "), false)
  })

  test("partitions aliases and normalizes path separators", () => {
    assert.deepEqual(partitionPortableAliasSlugs(["old-title", "d-*-g", "idvendor:idproduct"]), {
      portable: ["old-title"],
      rejected: ["d-*-g", "idvendor:idproduct"],
    })
    assert.deepEqual(partitionPortableAliasSlugs(["nested\\old-title"]), {
      portable: ["nested/old-title"],
      rejected: [],
    })
  })

  test("resolves dot-prefixed aliases with POSIX separators on Windows", () => {
    const canonical = "1c-计算机知识库/_terms/目标文件"

    assert.equal(resolvePortableAliasSlug(".o", canonical), "1c-计算机知识库/_terms/.o")
    assert.equal(resolvePortableAliasSlug(".obj", canonical), "1c-计算机知识库/_terms/.obj")
    assert.equal(resolvePortableAliasSlug("../old-title", canonical), "1c-计算机知识库/old-title")
    assert.equal(resolvePortableAliasSlug("global-title", canonical), "global-title")
  })
})

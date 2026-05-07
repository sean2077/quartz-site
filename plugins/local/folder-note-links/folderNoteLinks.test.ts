import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { describe, test } from "node:test"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { Root } from "hast"
import type { FilePath, FullSlug } from "@quartz-community/utils"
import { buildPublishedSlugSet, resolveFolderNoteLink, rewriteFolderNoteLinks } from "./index"

function linkTree(href: string, dataSlug: string): Root {
  return {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "a",
        properties: { href, "data-slug": dataSlug },
        children: [{ type: "text", value: dataSlug }],
      },
    ],
  }
}

describe("folder note links", () => {
  test("rewrites broken sibling directory links to folder-note index pages", () => {
    const tree = linkTree("../01-通用编程语言", "01-通用编程语言")
    const result = rewriteFolderNoteLinks(
      tree,
      "1c-计算机知识库/index" as FullSlug,
      ["1c-计算机知识库/index", "1c-计算机知识库/01-通用编程语言/index"] as FullSlug[],
      new Set(["1c-计算机知识库/index", "1c-计算机知识库/01-通用编程语言/index"] as FullSlug[]),
      ["01-通用编程语言"],
    )

    const link = tree.children[0]
    assert.equal(link.type, "element")
    assert.equal(link.properties.href, "../1c-计算机知识库/01-通用编程语言/")
    assert.equal(link.properties["data-slug"], "1c-计算机知识库/01-通用编程语言/index")
    assert.deepEqual(result, {
      rewrites: 1,
      links: ["1c-计算机知识库/01-通用编程语言/"],
    })
  })

  test("uses nearest ancestor folder-note match for nested folder pages", () => {
    assert.equal(
      resolveFolderNoteLink(
        "1d-人工智能知识库/世界模型/index" as FullSlug,
        "具身智能" as FullSlug,
        new Set(["1d-人工智能知识库/具身智能/index"] as FullSlug[]),
      ),
      "1d-人工智能知识库/具身智能/index",
    )
  })

  test("rewrites to a published folder-note even when a short unpublished slug exists", () => {
    const tree = linkTree("../../12.线段树", "12.线段树")
    rewriteFolderNoteLinks(
      tree,
      "1f-数据结构与算法/02.数据结构/index" as FullSlug,
      ["12.线段树", "1f-数据结构与算法/02.数据结构/12.线段树/index"] as FullSlug[],
      new Set(["1f-数据结构与算法/02.数据结构/12.线段树/index"] as FullSlug[]),
    )

    const link = tree.children[0]
    assert.equal(link.type, "element")
    assert.equal(link.properties.href, "../../1f-数据结构与算法/02.数据结构/12.线段树/")
    assert.equal(link.properties["data-slug"], "1f-数据结构与算法/02.数据结构/12.线段树/index")
  })

  test("removes href for unpublished folder-note targets", () => {
    const tree = linkTree("../11-分布式系统", "11-分布式系统")
    const result = rewriteFolderNoteLinks(
      tree,
      "1c-计算机知识库/index" as FullSlug,
      ["1c-计算机知识库/11-分布式系统/index"] as FullSlug[],
      new Set(["1c-计算机知识库/index"] as FullSlug[]),
      ["11-分布式系统"],
    )

    const link = tree.children[0]
    assert.equal(link.type, "element")
    assert.equal(link.tagName, "span")
    assert.equal(link.properties.href, undefined)
    assert.equal(link.properties["data-slug"], undefined)
    assert.deepEqual(result.links, [])
  })

  test("leaves already valid links unchanged", () => {
    const tree = linkTree("../known", "known")
    const result = rewriteFolderNoteLinks(
      tree,
      "notes/index" as FullSlug,
      ["known"] as FullSlug[],
      new Set(["known"] as FullSlug[]),
    )

    const link = tree.children[0]
    assert.equal(link.type, "element")
    assert.equal(link.properties.href, "../known")
    assert.equal(link.properties["data-slug"], "known")
    assert.equal(result.rewrites, 0)
  })

  test("ignores external links", () => {
    const tree = linkTree("https://example.com", "missing")
    const result = rewriteFolderNoteLinks(
      tree,
      "notes/index" as FullSlug,
      ["notes/missing/index"] as FullSlug[],
      new Set(["notes/missing/index"] as FullSlug[]),
    )

    const link = tree.children[0]
    assert.equal(link.type, "element")
    assert.equal(link.properties.href, "https://example.com")
    assert.equal(result.rewrites, 0)
  })

  test("does not rewrite ambiguous non-local folder-note matches", () => {
    assert.equal(
      resolveFolderNoteLink(
        "notes/page" as FullSlug,
        "topic" as FullSlug,
        new Set(["a/topic/index", "b/topic/index"] as FullSlug[]),
      ),
      undefined,
    )
  })

  test("builds published slug set from publish:true frontmatter and folder ancestors", () => {
    const dir = mkdtempSync(join(tmpdir(), "folder-note-links-"))

    try {
      mkdirSync(join(dir, "1C 计算机知识库", "01-通用编程语言"), { recursive: true })
      mkdirSync(join(dir, "1C 计算机知识库", "11-分布式系统"), { recursive: true })
      writeFileSync(
        join(dir, "1C 计算机知识库", "01-通用编程语言", "01-通用编程语言.md"),
        "---\npublish: true\n---\n",
      )
      writeFileSync(
        join(dir, "1C 计算机知识库", "11-分布式系统", "11-分布式系统.md"),
        "---\npublish: false\n---\n",
      )

      const slugs = buildPublishedSlugSet(dir)
      assert.equal(slugs.has("1c-计算机知识库/01-通用编程语言/index" as FullSlug), true)
      assert.equal(slugs.has("1c-计算机知识库/index" as FullSlug), true)
      assert.equal(slugs.has("1c-计算机知识库/11-分布式系统/index" as FullSlug), false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("builds published slug set only from provided input files", () => {
    const dir = mkdtempSync(join(tmpdir(), "folder-note-links-"))

    try {
      mkdirSync(join(dir, "published"), { recursive: true })
      mkdirSync(join(dir, "ignored"), { recursive: true })
      writeFileSync(join(dir, "published", "published.md"), "---\npublish: true\n---\n")
      writeFileSync(join(dir, "ignored", "ignored.md"), "---\npublish: true\n---\n")

      const slugs = buildPublishedSlugSet(dir, ["published/published.md" as FilePath])
      assert.equal(slugs.has("published/index" as FullSlug), true)
      assert.equal(slugs.has("ignored/index" as FullSlug), false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("ignores malformed frontmatter while building published slug set", () => {
    const dir = mkdtempSync(join(tmpdir(), "folder-note-links-"))

    try {
      writeFileSync(join(dir, "template.md"), "---\ncreated: {{date}} {{time}}\n---\n")

      const slugs = buildPublishedSlugSet(dir)
      assert.equal(slugs.size, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

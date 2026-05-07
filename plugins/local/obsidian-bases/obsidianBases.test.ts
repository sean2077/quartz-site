import test, { describe } from "node:test"
import assert from "node:assert"
import type { Root } from "hast"
import { renderBasePlaceholders } from "./src/render"
import { parseFilter } from "./src/query"

describe("ObsidianBases render transform", () => {
  test("replaces a parsed base placeholder with a rendered table", () => {
    const root: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["base-placeholder"], dataBaseId: "base-note-0" },
          children: [],
        },
      ],
    }
    const fileData = {
      slug: "note",
      baseBlocks: [
        {
          id: "base-note-0",
          config: {
            views: [{ type: "paginated-table", name: "Table", order: ["file.name"] }],
          },
        },
      ],
    }
    const allFiles = [
      {
        slug: "note",
        frontmatter: { title: "Current" },
      },
      {
        slug: "target",
        frontmatter: { title: "Target" },
      },
    ]

    renderBasePlaceholders(root, fileData, allFiles)

    const rendered = root.children[0]
    assert.equal(rendered.type, "element")
    assert.equal(rendered.type === "element" && rendered.tagName, "div")
    assert.match(JSON.stringify(rendered), /base-paginated-table/)
    assert.match(JSON.stringify(rendered), /Target/)
  })

  test("matches wikilink arrays against this.file", () => {
    const currentFile = {
      slug: "1A/tools/_resource_cards/resource_type/代码仓库",
      filePath: "obsidian-vault/1A/tools/_resource_cards/resource_type/代码仓库.md",
      relativePath: "1A/tools/_resource_cards/resource_type/代码仓库.md",
      frontmatter: { title: "代码仓库" },
    }
    const matchingResource = {
      slug: "resource",
      frontmatter: {
        title: "Resource",
        resource_types: ["[[代码仓库]]", "[[文档]]"],
      },
    }
    const otherResource = {
      slug: "other",
      frontmatter: {
        title: "Other",
        resource_types: ["[[视频]]"],
      },
    }

    const filter = parseFilter("resource_types.contains(this.file)", currentFile)

    assert.equal(filter(matchingResource, [], currentFile), true)
    assert.equal(filter(otherResource, [], currentFile), false)
  })
})

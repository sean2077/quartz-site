import test, { describe } from "node:test"
import assert from "node:assert"
import type { Root } from "hast"
import type { FilePath, FullSlug, QuartzPluginData } from "@quartz-community/types"
import { renderBasePlaceholders } from "./src/render"
import { executeQuery, executeViewQueries, parseFilter } from "./src/query"
import type { BaseConfig } from "./src/types"

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
    const fileData: QuartzPluginData = {
      slug: "note" as FullSlug,
      baseBlocks: [
        {
          id: "base-note-0",
          config: {
            views: [{ type: "paginated-table", name: "Table", order: ["file.name"] }],
          },
        },
      ],
    }
    const allFiles: QuartzPluginData[] = [
      {
        slug: "note" as FullSlug,
        frontmatter: { title: "Current" },
      },
      {
        slug: "target" as FullSlug,
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
    const currentFile: QuartzPluginData = {
      slug: "1A/tools/_resource_cards/resource_type/代码仓库" as FullSlug,
      filePath: "obsidian-vault/1A/tools/_resource_cards/resource_type/代码仓库.md" as FilePath,
      relativePath: "1A/tools/_resource_cards/resource_type/代码仓库.md" as FilePath,
      frontmatter: { title: "代码仓库" },
    }
    const matchingResource: QuartzPluginData = {
      slug: "resource" as FullSlug,
      frontmatter: {
        title: "Resource",
        resource_types: ["[[代码仓库]]", "[[文档]]"],
      },
    }
    const otherResource: QuartzPluginData = {
      slug: "other" as FullSlug,
      frontmatter: {
        title: "Other",
        resource_types: ["[[视频]]"],
      },
    }

    const filter = parseFilter("resource_types.contains(this.file)", currentFile)

    assert.equal(filter(matchingResource, [], currentFile), true)
    assert.equal(filter(otherResource, [], currentFile), false)
  })

  test("handles string tags and does not match partial folder prefixes", () => {
    const hasTag = parseFilter('file.hasTag("book")')
    const inFolder = parseFilter('file.inFolder("foo")')

    for (const tags of ["book", "#book, draft"]) {
      // Deliberately model raw YAML input outside the normalized string[] type.
      const rawFile = {
        slug: "note",
        frontmatter: { title: "Note", tags },
      } as unknown as QuartzPluginData
      assert.equal(hasTag(rawFile, [], undefined), true)
    }
    assert.equal(inFolder({ slug: "foo/note" as FullSlug }, [], undefined), true)
    assert.equal(inFolder({ slug: "root/foo/note" as FullSlug }, [], undefined), true)
    assert.equal(inFolder({ slug: "foobar/note" as FullSlug }, [], undefined), false)
  })

  test("treats null filter expressions as accept-all", () => {
    const filter = parseFilter(null)

    assert.equal(filter({ slug: "note" as FullSlug }, [], undefined), true)
  })

  test("queries each tab's filter, sort and limit independently", () => {
    const files: QuartzPluginData[] = [
      {
        slug: "todo-low" as FullSlug,
        frontmatter: { title: "Todo low", status: "todo", rank: 1, kind: "book" },
      },
      {
        slug: "other" as FullSlug,
        frontmatter: { title: "Other", status: "done", rank: 10, kind: "movie" },
      },
      {
        slug: "done-high" as FullSlug,
        frontmatter: { title: "Done high", status: "done", rank: 3, kind: "book" },
      },
      {
        slug: "todo-high" as FullSlug,
        frontmatter: { title: "Todo high", status: "todo", rank: 5, kind: "book" },
      },
      {
        slug: "done-low" as FullSlug,
        frontmatter: { title: "Done low", status: "done", rank: 2, kind: "book" },
      },
    ]
    const originalOrder = files.map((file) => file.slug)
    const config: BaseConfig = {
      filters: 'kind == "book"',
      views: [
        {
          type: "table",
          name: "Todo",
          filters: 'status == "todo"',
          sort: [{ property: "rank", direction: "desc" }],
          limit: 1,
        },
        {
          type: "paginated-table",
          name: "Done",
          filters: 'status == "done"',
          sort: [{ property: "rank", direction: "asc" }],
        },
      ],
    }

    const results = executeViewQueries(files, config, 1)

    assert.deepEqual(
      results.map((view) => view.map((file) => file.slug)),
      [["todo-high"], ["done-low", "done-high"]],
    )
    assert.deepEqual(executeQuery(files, config, 1), results[0])
    assert.deepEqual(
      files.map((file) => file.slug),
      originalOrder,
    )

    const root: Root = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "div",
          properties: { className: ["base-placeholder"], dataBaseId: "views" },
          children: [],
        },
      ],
    }
    renderBasePlaceholders(
      root,
      { slug: "index" as FullSlug, baseBlocks: [{ id: "views", config }] },
      files,
      {
        maxResults: 1,
      },
    )
    const rendered = root.children[0]
    assert.equal(rendered.type, "element")
    if (rendered.type !== "element") return
    const serialized = JSON.stringify(rendered)
    assert.match(serialized, /Todo high/)
    assert.match(serialized, /Done low/)
    assert.match(serialized, /Done high/)
    assert.doesNotMatch(serialized, /Todo low|Other/)
  })

  test("evaluates global filters once across tabs and resolves each view against its owner", () => {
    let globalReads = 0
    const owner: QuartzPluginData = {
      slug: "books/index" as FullSlug,
      frontmatter: { title: "Books" },
    }
    const files: QuartzPluginData[] = [
      {
        slug: "books/a" as FullSlug,
        frontmatter: {
          title: "A",
          get isListed() {
            globalReads++
            return true
          },
        },
      },
      {
        slug: "films/b" as FullSlug,
        frontmatter: {
          title: "B",
          get isListed() {
            globalReads++
            return true
          },
        },
      },
    ]
    const config: BaseConfig = {
      filters: "isListed",
      views: [
        { type: "table", name: "Here", filters: "file.inFolder(this.file.folder)" },
        { type: "table", name: "Elsewhere", filters: "!file.inFolder(this.file.folder)" },
      ],
    }

    const results = executeViewQueries(files, config, 100, owner)

    assert.deepEqual(
      results.map((view) => view.map((file) => file.slug)),
      [["books/a"], ["films/b"]],
    )
    assert.equal(globalReads, files.length)
  })
})

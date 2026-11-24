import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { fromHtml } from "hast-util-from-html"
import { visit } from "unist-util-visit"

const root = fileURLToPath(new URL("../", import.meta.url))
process.chdir(root)

// These are generated public test notes, never the independent Obsidian vault.
// Keep the fixture outside the checkout: glob() honors the checkout's .gitignore,
// which deliberately excludes .quartz/ and the independent content source.
const input = (await mkdtemp(path.join(tmpdir(), "quartz-smoke-"))).replaceAll("\\", "/")
const output = ".quartz/smoke-public"
await cp(new URL("../tests/fixtures/site/", import.meta.url), input, { recursive: true })
await mkdir(`${input}/Samples`, { recursive: true })
for (let number = 1; number <= 45; number++) {
  const id = String(number).padStart(2, "0")
  await writeFile(
    `${input}/Samples/Note-${id}.md`,
    `---\ntitle: Sample ${id}\npublish: true\nrank: ${number}\nstatus: ${number % 2 ? "todo" : "done"}\ntags: [sample]\n---\n\nSample ${id} for pagination and search. Back to [[index|the notebook]].\n`,
  )
}

const result = spawnSync(
  process.execPath,
  ["quartz/bootstrap-cli.mjs", "build", "-d", input, "-o", output, "--concurrency", "2"],
  { stdio: "inherit" },
)
await rm(input, { recursive: true, force: true })
if (result.error) throw result.error
assert.equal(result.status, 0, "The smoke site must build successfully")

const html = await readFile(`${output}/index.html`, "utf8")
assert.match(html, /阅读与记录/)
assert.match(html, /mobile-toc-panel/)
const document = fromHtml(html)
const elementsWithClass = (className) => {
  const elements = []
  visit(document, "element", (node) => {
    if (node.properties.className?.includes(className)) elements.push(node)
  })
  return elements
}
const bodyRows = (tableView) => {
  const rows = []
  visit(tableView, "element", (node) => {
    if (node.tagName === "tbody") {
      rows.push(
        ...node.children.filter((child) => child.type === "element" && child.tagName === "tr"),
      )
    }
  })
  return rows
}
const textOf = (node) =>
  node.type === "text" ? node.value : (node.children ?? []).map(textOf).join("")

assert.equal(
  elementsWithClass("base-error").length,
  0,
  "All fixture Bases blocks must render successfully",
)
const paginatedViews = elementsWithClass("base-paginated-table")
assert.equal(paginatedViews.length, 1)
assert.equal(
  bodyRows(paginatedViews[0]).length,
  45,
  "The full SSR pagination fallback must contain all 45 samples",
)
const doneViews = elementsWithClass("base-table")
assert.equal(doneViews.length, 1)
const doneRows = bodyRows(doneViews[0])
assert.equal(doneRows.length, 3, "The second tab must apply its own filter and limit")
assert.deepEqual(
  doneRows.map((row) => {
    const cells = row.children.filter((child) => child.type === "element" && child.tagName === "td")
    assert.equal(textOf(cells[2]), "done")
    return Number(textOf(cells[1]))
  }),
  [44, 42, 40],
  "The second tab must use its own descending rank order",
)
assert.match(await readFile(`${output}/notes/index.html`, "utf8"), /笔记目录/)
assert.equal(
  await readFile(`${output}/notes/index`, "utf8"),
  await readFile(`${output}/notes/index.html`, "utf8"),
  "Cloudflare folder aliases must contain the same HTML",
)
assert.match(await readFile(`${output}/_headers`, "utf8"), /Content-Type: text\/html/)
assert.match(await readFile(`${output}/attachments/visible.svg`, "utf8"), /public-smoke-asset/)

const index = JSON.parse(await readFile(`${output}/static/contentIndex.json`, "utf8"))
assert(index["notes/reading"])
assert.equal(Object.keys(index).filter((slug) => slug.startsWith("samples/note-")).length, 45)
assert(!index.unpublished, "Unpublished notes must be absent from search")
assert(!index.draft, "Draft notes must be absent from search")
const files = await readdir(output, { recursive: true })
assert(!files.some((file) => path.basename(file).toLowerCase() === "unpublished.html"))
assert(!files.some((file) => path.basename(file).toLowerCase() === "draft.html"))
assert(!files.some((file) => path.basename(file) === "unpublished.svg"))

console.log(`Smoke build passed: ${Object.keys(index).length} indexed pages; preview in ${output}`)

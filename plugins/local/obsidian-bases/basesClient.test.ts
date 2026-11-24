import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runInNewContext } from "node:vm"
import { transformSync } from "esbuild"

// Exercise the shipped inline script, with a small DOM boundary rather than a
// duplicate of its pagination/filtering implementation.
class Element {
  dataset: Record<string, string> = {}
  children: Element[] = []
  textContent = ""
  value = ""
  disabled = false
  className = ""
  type = ""
  ariaLabel = ""
  ariaHidden = ""
  listeners = new Map<string, Set<(event: { target: Element }) => void>>()

  addEventListener(type: string, listener: (event: { target: Element }) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event: { target: Element }) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string, target: Element = this) {
    for (const listener of this.listeners.get(type) ?? []) listener({ target })
  }

  appendChild(child: Element) {
    this.children.push(child)
  }

  replaceChildren(...children: Element[]) {
    this.children = [...children]
  }

  closest(selector: string): Element | null {
    return selector === "td" && this.dataset.col ? this : null
  }
}

function tableHarness(count = 103) {
  let cellReads = 0
  const headers = ["title", "status", "date"].map((property) => {
    const header = new Element()
    header.dataset.property = property
    header.textContent = property
    return header
  })
  const rows = Array.from({ length: count }, (_, index) => {
    const title = `Note ${index + 1}`
    const values = [title, index % 2 ? "done" : "todo", `2026-${index % 2 ? "11" : "02"}-01`]
    const row = new Element() as Element & { cells: Element[] }
    row.dataset.searchable = values.join(" ").toLowerCase()
    row.cells = values.map((value, col) => {
      const cell = new Element() as Element & { querySelector: () => null }
      cell.dataset = { col: headers[col].dataset.property, value }
      cell.textContent = value
      cell.querySelector = () => {
        cellReads++
        return null
      }
      return cell
    })
    return row
  })
  const tbody = new Element() as Element & {
    querySelectorAll: (selector: string) => Element[]
    dispatchEvent: (event: Event) => boolean
  }
  tbody.children = [...rows]
  tbody.querySelectorAll = () => tbody.children
  const controls = Object.fromEntries(
    [
      ".bpt-search",
      ".bpt-prev",
      ".bpt-next",
      ".bpt-page-size-select",
      ".bpt-page-info",
      ".bpt-active-filters",
    ].map((selector) => [selector, new Element()]),
  )
  const container = new Element() as Element & {
    querySelector: (selector: string) => Element | undefined
    querySelectorAll: (selector: string) => Element[]
  }
  container.dataset.pageSize = "10"
  container.querySelector = (selector) => (selector === "tbody" ? tbody : controls[selector])
  container.querySelectorAll = () => headers

  let navigate: () => void = () => {}
  const cleanups: Array<() => void> = []
  const renderedRows: Element[][] = []
  const renderEvents: Event[] = []
  tbody.dispatchEvent = (event) => {
    if (event.type === "render") {
      renderedRows.push([...tbody.children])
      renderEvents.push(event)
    }
    return true
  }
  let timeout: (() => void) | undefined
  const source = readFileSync(new URL("./src/bases.inline.ts", import.meta.url), "utf8")
  runInNewContext(transformSync(source, { loader: "ts" }).code, {
    document: {
      addEventListener: (_type: string, callback: () => void) => {
        navigate = callback
      },
      querySelectorAll: (selector: string) =>
        selector === ".base-paginated-table" ? [container] : [],
      createElement: () => new Element(),
      createTextNode: (text: string) => Object.assign(new Element(), { textContent: text }),
    },
    window: { addCleanup: (cleanup: () => void) => cleanups.push(cleanup) },
    CustomEvent,
    setTimeout: (callback: () => void) => {
      timeout = callback
      return 1
    },
    clearTimeout: () => {
      timeout = undefined
    },
  })
  navigate()

  return {
    rows,
    tbody,
    controls,
    headers,
    container,
    renderedRows,
    renderEvents,
    cellReads: () => cellReads,
    search: (value: string) => {
      controls[".bpt-search"].value = value
      controls[".bpt-search"].emit("input")
      timeout?.()
    },
    cleanup: () => cleanups.splice(0).forEach((cleanup) => cleanup()),
    navigate: () => navigate(),
  }
}

test("pagination mounts only the selected page and reuses cached sort/filter results", () => {
  const table = tableHarness()
  const { tbody, controls, headers, rows } = table
  assert.equal(tbody.children.length, 10)
  assert.equal(controls[".bpt-page-info"].textContent, "1-10 of 103")

  headers[0].emit("click")
  const readsAfterSort = table.cellReads()
  controls[".bpt-next"].emit("click")
  assert.equal(controls[".bpt-page-info"].textContent, "11-20 of 103")
  assert.equal(tbody.children[0], rows[10])
  assert.equal(table.cellReads(), readsAfterSort, "changing page must not reread every cell")

  table.search("note 103")
  assert.deepEqual(tbody.children, [rows[102]])
  assert.equal(controls[".bpt-page-info"].textContent, "1-1 of 1")
  assert.equal(controls[".bpt-next"].disabled, true)
  table.search("no matching note")
  assert.equal(tbody.children.length, 0)
  assert.equal(controls[".bpt-page-info"].textContent, "No results")
})

test("sort treats full dates naturally and quick filters include detached rows", () => {
  const { tbody, controls, headers, rows } = tableHarness()
  headers[2].emit("click")
  assert.deepEqual(tbody.children, rows.filter((_, index) => index % 2 === 0).slice(0, 10))
  headers[2].emit("click")
  assert.deepEqual(tbody.children, rows.filter((_, index) => index % 2 === 1).slice(0, 10))

  tbody.emit("click", rows[1].cells[1])
  assert.equal(controls[".bpt-page-info"].textContent, "1-10 of 51")
  controls[".bpt-next"].emit("click")
  assert.equal(controls[".bpt-page-info"].textContent, "11-20 of 51")
  assert.deepEqual(tbody.children, rows.filter((_, index) => index % 2 === 1).slice(10, 20))

  controls[".bpt-active-filters"].children[0].emit("click")
  assert.equal(controls[".bpt-page-info"].textContent, "1-10 of 103")
})

test("cleanup restores complete fallback markup and allows SPA reinitialization", () => {
  const table = tableHarness()
  table.search("note 103")
  table.cleanup()

  assert.deepEqual(table.tbody.children, table.rows)
  assert.equal(table.container.dataset.initialized, "false")
  assert.equal(table.controls[".bpt-search"].value, "")
  assert.equal(table.controls[".bpt-next"].listeners.get("click")?.size, 0)
  table.navigate()
  assert.equal(table.tbody.children.length, 10)
  table.controls[".bpt-next"].emit("click")
  assert.equal(table.controls[".bpt-page-info"].textContent, "11-20 of 103")
})

test("pagination notifies link enhancers after mounting each new page", () => {
  const { controls, rows, renderedRows, renderEvents } = tableHarness()
  assert.deepEqual(renderedRows, [rows.slice(0, 10)])

  controls[".bpt-next"].emit("click")
  assert.deepEqual(renderedRows[1], rows.slice(10, 20))
  controls[".bpt-prev"].emit("click")
  assert.deepEqual(renderedRows[2], rows.slice(0, 10))
  assert.equal(renderEvents.length, 3)
  assert(
    renderEvents.every((event) => !event.bubbles),
    "table updates must not rerun global render listeners",
  )
})

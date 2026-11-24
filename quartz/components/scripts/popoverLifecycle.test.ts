import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"
import { buildSync } from "esbuild"

class Link extends EventTarget {
  additions = new Map<string, number>()
  removals = new Map<string, number>()

  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    this.additions.set(type, (this.additions.get(type) ?? 0) + 1)
    super.addEventListener(type, listener)
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    this.removals.set(type, (this.removals.get(type) ?? 0) + 1)
    super.removeEventListener(type, listener)
  }
}

// Minimal DOM event boundary: a content element is a descendant of document.
// Browser-level behavior is also covered by the pagination/hover end-to-end test.
class DocumentBoundary {
  links: Link[] = []
  listeners = new Map<string, Array<{ callback: (event: Event) => void; capture: boolean }>>()

  querySelectorAll(selector: string) {
    return selector === "a.internal" ? this.links : []
  }

  addEventListener(
    type: string,
    callback: (event: Event) => void,
    options: boolean | AddEventListenerOptions = false,
  ) {
    const capture = typeof options === "boolean" ? options : Boolean(options.capture)
    const listeners = this.listeners.get(type) ?? []
    listeners.push({ callback, capture })
    this.listeners.set(type, listeners)
  }

  dispatchFrom(target: DocumentBoundary | ContentElement, event: Event) {
    Object.defineProperty(event, "target", { value: target })
    for (const { callback, capture } of this.listeners.get(event.type) ?? []) {
      if (target === this || capture || event.bubbles) callback(event)
    }
    return true
  }

  dispatchEvent(event: Event) {
    return this.dispatchFrom(this, event)
  }
}

class ContentElement {
  links: Link[] = []

  constructor(private document: DocumentBoundary) {}

  querySelectorAll(selector: string) {
    return selector === "a.internal" ? this.links : []
  }

  dispatchEvent(event: Event) {
    return this.document.dispatchFrom(this, event)
  }
}

test("dynamic links get popovers once per SPA lifecycle", () => {
  // Bundle the actual production script and dependencies. Only the DOM boundary
  // is substituted, so this exercises setupPopovers and its registered cleanup.
  const script = buildSync({
    entryPoints: [fileURLToPath(new URL("./popover.inline.ts", import.meta.url))],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
  }).outputFiles[0].text
  const firstPage = new Link()
  const secondPage = new Link()
  const unrelatedLink = new Link()
  const cleanups = new Set<() => void>()
  const document = new DocumentBoundary()
  document.links = [firstPage]
  const content = new ContentElement(document)
  let globalRenderCalls = 0
  document.addEventListener("render", () => {
    globalRenderCalls++
  })
  const window = Object.assign(new EventTarget(), {
    addCleanup: (cleanup: () => void) => cleanups.add(cleanup),
  })
  runInNewContext(script, { document, window, DOMParser: class {}, Element: ContentElement })

  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "index" } }))
  assert.equal(firstPage.additions.get("mouseenter"), 1)
  assert.equal(cleanups.size, 1)

  document.links = [secondPage, unrelatedLink]
  content.links = [secondPage]
  content.dispatchEvent(new CustomEvent("render", { detail: {}, bubbles: false }))
  assert.equal(secondPage.additions.get("mouseenter"), 1)
  assert.equal(secondPage.additions.get("mouseleave"), 1)
  assert.equal(cleanups.size, 2, "newly mounted links need their own cleanup")
  assert.equal(
    unrelatedLink.additions.size,
    0,
    "scoped renders should scan only the changed subtree",
  )
  assert.equal(globalRenderCalls, 0, "scoped renders must not rerun ordinary document listeners")

  for (let iteration = 0; iteration < 5; iteration++) {
    content.links = iteration % 2 ? [secondPage] : [firstPage]
    content.dispatchEvent(new CustomEvent("render", { detail: {}, bubbles: false }))
  }
  assert.equal(firstPage.additions.get("mouseenter"), 1)
  assert.equal(secondPage.additions.get("mouseenter"), 1)
  assert.equal(cleanups.size, 2, "render must not accumulate duplicate cleanup closures")
  assert.equal(globalRenderCalls, 0)

  document.dispatchEvent(new CustomEvent("render", { detail: {} }))
  assert.equal(
    unrelatedLink.additions.get("mouseenter"),
    1,
    "existing document renders must still work",
  )
  assert.equal(globalRenderCalls, 1)
  assert.equal(cleanups.size, 3)

  cleanups.forEach((cleanup) => cleanup())
  cleanups.clear()
  for (const link of [firstPage, secondPage, unrelatedLink]) {
    assert.equal(link.removals.get("mouseenter"), 1)
    assert.equal(link.removals.get("mouseleave"), 1)
  }

  document.links = [firstPage]
  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "index" } }))
  assert.equal(firstPage.additions.get("mouseenter"), 2, "SPA may reuse a previously bound node")
  assert.equal(cleanups.size, 1)
})

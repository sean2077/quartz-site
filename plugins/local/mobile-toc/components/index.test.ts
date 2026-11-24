import test from "node:test"
import assert from "node:assert/strict"
import { runInNewContext } from "node:vm"
import { isValidElement } from "preact"
import { renderToString } from "preact-render-to-string"
import type { QuartzComponentProps } from "@quartz-community/types"
import { MobileToc, mobileTocScript } from "./index.ts"

class Control extends EventTarget {
  onFocus?: () => void
  attributes = new Map<string, string>()
  classes = new Set<string>()
  classList = {
    toggle: (name: string, value: boolean) => {
      if (value) this.classes.add(name)
      else this.classes.delete(name)
    },
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  click() {
    this.dispatchEvent(new Event("click"))
  }
  focus() {
    this.onFocus?.()
  }
}

function setup() {
  const toggle = new Control()
  const close = new Control()
  const top = new Control()
  const middleLink = new Control()
  const link = new Control()
  class Dialog extends Control {
    open = false
    showModal() {
      this.open = true
    }
    close() {
      this.open = false
      this.dispatchEvent(new Event("close"))
    }
    getBoundingClientRect() {
      return { top: 400, left: 0, right: 390, bottom: 844 }
    }
    querySelectorAll() {
      return [middleLink, link]
    }
  }
  const panel = new Dialog()
  const elements = new Map<string, Control>([
    [".mobile-toc-toggle", toggle],
    [".mobile-toc-close", close],
    [".mobile-toc-panel", panel],
    [".mobile-back-to-top", top],
  ])
  const document = Object.assign(new EventTarget(), {
    activeElement: null as Control | null,
    body: { style: { overflow: "auto" } },
    querySelector: (selector: string) => elements.get(selector),
  })
  for (const control of [toggle, close, top, middleLink, link]) {
    control.onFocus = () => {
      document.activeElement = control
    }
  }
  const viewport = Object.assign(new EventTarget(), { matches: true })
  const motion = { matches: false }
  const cleanups: Array<() => void> = []
  const scrolls: Array<{ top: number; behavior: string }> = []
  const window = Object.assign(new EventTarget(), {
    scrollY: 0,
    matchMedia: (query: string) => (query.includes("max-width") ? viewport : motion),
    addCleanup: (fn: () => void) => cleanups.push(fn),
    scrollTo: (options: { top: number; behavior: string }) => scrolls.push(options),
  })
  runInNewContext(mobileTocScript, { document, window })
  document.dispatchEvent(new Event("nav"))
  return {
    toggle,
    close,
    top,
    middleLink,
    link,
    panel,
    document,
    viewport,
    motion,
    cleanups,
    scrolls,
    window,
  }
}

function keydown(target: EventTarget, key: string, shiftKey = false, ctrlKey = false) {
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    key,
    shiftKey,
    ctrlKey,
  })
  target.dispatchEvent(event)
  return event
}

test("mobile TOC exposes a named native dialog and localized controls", () => {
  const component = MobileToc()
  const props = {
    cfg: { locale: "zh-CN" },
    fileData: { toc: [{ slug: "intro", depth: 0, text: "引言" }] },
  } as unknown as QuartzComponentProps
  const rendered = component(props)
  assert.ok(isValidElement(rendered))
  const html = renderToString(rendered)
  assert.match(html, /<dialog[^>]*aria-labelledby="mobile-toc-title"/)
  assert.match(html, /aria-controls="mobile-toc-panel"/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /aria-haspopup="dialog"/)
  assert.match(html, /aria-label="关闭目录"/)
  assert.doesNotMatch(html, /<dialog[^>]* open[\s>]/)
})

test("close, native Escape, backdrop, and breakpoint changes restore the prior scroll state", () => {
  const { toggle, close, link, panel, document, viewport } = setup()
  toggle.click()
  assert.equal(panel.open, true)
  assert.equal(toggle.attributes.get("aria-expanded"), "true")
  assert.equal(document.body.style.overflow, "hidden")
  close.click()
  assert.equal(panel.open, false)
  assert.equal(document.body.style.overflow, "auto")

  toggle.click()
  panel.close() // Native dialog Escape dispatches close.
  assert.equal(toggle.attributes.get("aria-expanded"), "false")
  assert.equal(document.body.style.overflow, "auto")

  toggle.click()
  link.click()
  assert.equal(panel.open, false)
  assert.equal(document.body.style.overflow, "auto")

  toggle.click()
  const inside = Object.assign(new Event("click"), { clientX: 100, clientY: 450 })
  panel.dispatchEvent(inside)
  assert.equal(panel.open, true)
  const outside = Object.assign(new Event("click"), { clientX: 100, clientY: 100 })
  panel.dispatchEvent(outside)
  assert.equal(panel.open, false)

  toggle.click()
  viewport.matches = false
  viewport.dispatchEvent(new Event("change"))
  assert.equal(panel.open, false)
  assert.equal(document.body.style.overflow, "auto")
  toggle.click()
  assert.equal(panel.open, false)
})

test("SPA cleanup closes the sheet and removes handlers; reduced motion skips smooth scrolling", () => {
  const { toggle, top, panel, document, motion, cleanups, scrolls, window } = setup()
  window.scrollY = 500
  window.dispatchEvent(new Event("scroll"))
  assert.equal(top.classes.has("visible"), true)
  top.click()
  assert.equal(scrolls.at(-1)?.behavior, "smooth")
  motion.matches = true
  top.click()
  assert.equal(scrolls.at(-1)?.behavior, "instant")

  toggle.click()
  cleanups.forEach((cleanup) => cleanup())
  assert.equal(panel.open, false)
  assert.equal(document.body.style.overflow, "auto")
  toggle.click()
  top.click()
  assert.equal(panel.open, false)
  assert.equal(scrolls.length, 2)
})

test("Tab and Shift+Tab wrap only at the open TOC's focus boundaries", () => {
  const { toggle, close, middleLink, link, panel, document } = setup()
  toggle.click()
  link.focus()
  assert.equal(keydown(panel, "Tab").defaultPrevented, true)
  assert.equal(document.activeElement, close)
  assert.equal(keydown(panel, "Tab", true).defaultPrevented, true)
  assert.equal(document.activeElement, link)

  // Intermediate focus movement remains the browser's responsibility.
  middleLink.focus()
  assert.equal(keydown(panel, "Tab").defaultPrevented, false)
  assert.equal(keydown(panel, "Tab", true).defaultPrevented, false)
  assert.equal(document.activeElement, middleLink)
  close.focus()
  assert.equal(keydown(panel, "Tab").defaultPrevented, false)
  link.focus()
  assert.equal(keydown(panel, "Tab", true).defaultPrevented, false)
})

test("focus cycling ignores other keys, closed dialogs and disposed listeners", () => {
  const { toggle, link, panel, document, cleanups } = setup()
  toggle.click()
  link.focus()
  assert.equal(keydown(panel, "Escape").defaultPrevented, false)
  assert.equal(keydown(panel, "Enter").defaultPrevented, false)
  assert.equal(keydown(panel, "Tab", false, true).defaultPrevented, false)
  assert.equal(document.activeElement, link)

  panel.close()
  assert.equal(keydown(panel, "Tab").defaultPrevented, false)
  assert.equal(document.activeElement, link)
  cleanups.forEach((cleanup) => cleanup())
  panel.showModal()
  assert.equal(keydown(panel, "Tab").defaultPrevented, false)
  assert.equal(document.activeElement, link)
})

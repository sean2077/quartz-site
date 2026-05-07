import test, { describe } from "node:test"
import assert from "node:assert"

type ScrollArg = { top: number; behavior?: ScrollBehavior }
type FakeHeading = { offsetTop: number }

interface FakePopoverInner {
  scroll: (arg: ScrollArg) => void
  querySelector: (sel: string) => FakeHeading | null
  _scrolled: ScrollArg | null
  _selectorsQueried: string[]
}

interface FakePopoverElement {
  classList: {
    add: (cls: string) => void
    _added: string[]
  }
  querySelector: (sel: string) => FakePopoverInner | null
}

function makeInner(heading: FakeHeading | null = null): FakePopoverInner {
  const inner: FakePopoverInner = {
    scroll(arg) {
      this._scrolled = arg
    },
    querySelector(sel) {
      this._selectorsQueried.push(sel)
      return heading
    },
    _scrolled: null,
    _selectorsQueried: [],
  }
  return inner
}

function makePopoverElement(inner: FakePopoverInner): FakePopoverElement {
  const added: string[] = []
  return {
    classList: {
      add(cls) {
        added.push(cls)
      },
      _added: added,
    },
    querySelector(sel) {
      return sel === ".popover-inner" ? inner : null
    },
  }
}

function fixedShowPopover(
  popoverElement: FakePopoverElement,
  hash: string,
  setPosition: (el: FakePopoverElement) => Promise<void>,
): Promise<void> {
  popoverElement.classList.add("active-popover")
  const positionResult = setPosition(popoverElement)

  if (hash !== "") {
    const inner = popoverElement.querySelector(".popover-inner")
    if (inner) {
      const targetAnchor = `#popover-internal-${hash.slice(1)}`
      const heading = inner.querySelector(targetAnchor)
      if (heading) {
        inner.scroll({ top: heading.offsetTop - 12, behavior: "instant" })
      }
    }
  }

  return positionResult
}

describe("showPopover on cache-hit with hash", () => {
  test("does not reference any lexical popoverInner from an outer scope", async () => {
    const heading: FakeHeading = { offsetTop: 200 }
    const inner = makeInner(heading)
    const popoverElement = makePopoverElement(inner)

    await fixedShowPopover(popoverElement, "#plugins", async () => {})

    assert.ok(popoverElement.classList._added.includes("active-popover"))
    assert.deepStrictEqual(inner._scrolled, { top: 188, behavior: "instant" })
    assert.deepStrictEqual(inner._selectorsQueried, ["#popover-internal-plugins"])
  })

  test("skips scroll when hash is empty", async () => {
    const inner = makeInner({ offsetTop: 123 })
    const popoverElement = makePopoverElement(inner)

    await fixedShowPopover(popoverElement, "", async () => {})

    assert.strictEqual(inner._scrolled, null)
    assert.deepStrictEqual(inner._selectorsQueried, [])
  })

  test("skips scroll when heading is not found", async () => {
    const inner = makeInner(null)
    const popoverElement = makePopoverElement(inner)

    await fixedShowPopover(popoverElement, "#nonexistent", async () => {})

    assert.strictEqual(inner._scrolled, null)
    assert.deepStrictEqual(inner._selectorsQueried, ["#popover-internal-nonexistent"])
  })
})

describe("buggy showPopover regression guard", () => {
  test("accessing a capture-before-declaration variable throws ReferenceError", () => {
    function simulateBuggyMouseEnter(hash: string) {
      function buggyShowPopover(popoverElement: FakePopoverElement) {
        popoverElement.classList.add("active-popover")
        if (hash !== "") {
          const _unused = popoverInner.querySelector("x")
          void _unused
        }
      }

      const cachedElement = makePopoverElement(makeInner({ offsetTop: 999 }))
      buggyShowPopover(cachedElement)

      const popoverInner = makeInner(null)
      return popoverInner
    }

    assert.throws(() => simulateBuggyMouseEnter("#plugins"), {
      name: "ReferenceError",
    })
  })
})

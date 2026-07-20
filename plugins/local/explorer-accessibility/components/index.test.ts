import test from "node:test"
import assert from "node:assert/strict"
import { explorerAccessibilityScript } from "./index.ts"

type Listener = () => void

function createElement(classes: string[] = [], id = "") {
  const attributes = new Map<string, string>()
  const listeners = new Map<string, Listener>()
  const classNames = new Set(classes)

  return {
    id,
    attributes,
    listeners,
    classNames,
    classList: {
      contains(value: string) {
        return classNames.has(value)
      },
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
    addEventListener(name: string, listener: Listener) {
      listeners.set(name, listener)
    },
    removeEventListener(name: string, listener: Listener) {
      if (listeners.get(name) === listener) listeners.delete(name)
    },
  }
}

test("synchronizes Explorer ARIA state after clicks and class mutations", () => {
  const content = createElement([], "explorer-1")
  const mobileButton = createElement()
  const desktopButton = createElement()
  const explorer = {
    ...createElement(),
    querySelector(selector: string) {
      return selector === ".explorer-content" ? content : null
    },
    querySelectorAll(selector: string) {
      return selector === ".explorer-toggle" ? [mobileButton, desktopButton] : []
    },
  }

  const documentListeners = new Map<string, Listener>()
  const cleanup: Listener[] = []
  const observers: Array<{ callback: Listener; disconnected: boolean }> = []
  class FakeMutationObserver {
    private record: { callback: Listener; disconnected: boolean }

    constructor(callback: Listener) {
      this.record = { callback, disconnected: false }
      observers.push(this.record)
    }

    observe() {}

    disconnect() {
      this.record.disconnected = true
    }
  }

  const fakeDocument = {
    querySelectorAll(selector: string) {
      return selector === ".explorer" ? [explorer] : []
    },
    addEventListener(name: string, listener: Listener) {
      documentListeners.set(name, listener)
    },
  }
  const fakeWindow = {
    addCleanup(listener: Listener) {
      cleanup.push(listener)
    },
  }

  const runScript = new Function(
    "document",
    "window",
    "MutationObserver",
    "queueMicrotask",
    explorerAccessibilityScript,
  )
  runScript(fakeDocument, fakeWindow, FakeMutationObserver, (listener: Listener) => listener())

  documentListeners.get("nav")?.()
  for (const element of [explorer, content, mobileButton, desktopButton]) {
    assert.equal(element.attributes.get("aria-expanded"), "true")
  }
  assert.equal(content.attributes.get("aria-hidden"), "false")
  assert.equal(mobileButton.attributes.get("aria-controls"), "explorer-1")
  assert.equal(desktopButton.attributes.get("aria-controls"), "explorer-1")

  explorer.classNames.add("collapsed")
  desktopButton.listeners.get("click")?.()
  for (const element of [explorer, content, mobileButton, desktopButton]) {
    assert.equal(element.attributes.get("aria-expanded"), "false")
  }
  assert.equal(content.attributes.get("aria-hidden"), "true")

  explorer.classNames.delete("collapsed")
  observers[0]?.callback()
  assert.equal(desktopButton.attributes.get("aria-expanded"), "true")
  assert.equal(content.attributes.get("aria-hidden"), "false")

  cleanup[0]?.()
  assert.equal(mobileButton.listeners.size, 0)
  assert.equal(desktopButton.listeners.size, 0)
  assert.equal(observers[0]?.disconnected, true)
})

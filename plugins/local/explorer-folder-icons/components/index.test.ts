import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import type { VNode } from "preact"
import renderToString from "preact-render-to-string"
import type { QuartzComponentProps } from "@quartz-community/types"
import {
  ExplorerFolderIcons,
  explorerFolderIconsCss,
  explorerFolderIconsScript,
  reportExplorerFolderIconWarningsOnce,
} from "./index"

type Listener = () => void

function writeVaultFile(root: string, relativePath: string, content: string) {
  const filePath = path.join(root, ...relativePath.split("/"))
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

function componentProps(root: string, slugs: string[]): QuartzComponentProps {
  return {
    ctx: { argv: { directory: root } },
    allFiles: slugs.map((slug) => ({ slug })),
  } as unknown as QuartzComponentProps
}

function createClientElement(tagName: string) {
  const attributes = new Map<string, string>()
  const styleProperties = new Map<string, string>()
  const element = {
    tagName,
    className: "",
    parentElement: null as ReturnType<typeof createControl> | null,
    textContent: "",
    src: "",
    alt: "",
    draggable: true,
    attributes,
    styleProperties,
    classList: {
      contains(value: string) {
        return element.className.split(/\s+/).includes(value)
      },
    },
    style: {
      setProperty(name: string, value: string) {
        styleProperties.set(name, value)
      },
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
  }
  return element
}

function createControl() {
  const control = {
    children: [] as Array<ReturnType<typeof createClientElement> | ReturnType<typeof createTitle>>,
    insertBefore(
      child: ReturnType<typeof createClientElement>,
      reference: ReturnType<typeof createTitle>,
    ) {
      const index = control.children.indexOf(reference)
      child.parentElement = control
      control.children.splice(index, 0, child)
    },
  }
  return control
}

function createTitle(control: ReturnType<typeof createControl>) {
  const title = {
    parentElement: control,
    get previousElementSibling() {
      const index = control.children.indexOf(title)
      return index > 0 ? control.children[index - 1] : null
    },
  }
  return title
}

function createFolder(folderPath: string) {
  const control = createControl()
  const title = createTitle(control)
  control.children.push(title)

  return {
    control,
    title,
    folder: {
      dataset: { folderpath: folderPath },
      querySelector(selector: string) {
        return selector === ".folder-title" ? title : null
      },
    },
  }
}

test("renders only the published folder icon payload", () => {
  const root = mkdtempSync(path.join(tmpdir(), "explorer-folder-icons-component-"))
  try {
    mkdirSync(path.join(root, "Published"), { recursive: true })
    mkdirSync(path.join(root, "Private"), { recursive: true })
    writeVaultFile(
      root,
      ".obsidian/plugins/obsidian-icon-folder/data.json",
      JSON.stringify({
        settings: { debugMode: true },
        Published: "📚",
        Private: "🔒",
        "index.md": "🏠",
      }),
    )

    const component = ExplorerFolderIcons({})
    const html = renderToString(component(componentProps(root, ["published/note"])) as VNode)

    assert.match(html, /data-explorer-folder-icons=/)
    assert.match(html, /published\/index/)
    assert.match(html, /📚/)
    assert.doesNotMatch(html, /private\/index|debugMode|index\.md/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("reports each fallback warning only once per content root", () => {
  const contentRoot = path.join(tmpdir(), `explorer-folder-icons-warning-${Date.now()}`)
  const reported: string[] = []

  reportExplorerFolderIconWarningsOnce(contentRoot, ["missing data"], (message) => {
    reported.push(message)
  })
  reportExplorerFolderIconWarningsOnce(contentRoot, ["missing data"], (message) => {
    reported.push(message)
  })

  assert.deepEqual(reported, ["[ExplorerFolderIcons] missing data"])
})

test("decorates current and subsequently rendered Explorer folders exactly once", () => {
  const textFolder = createFolder("folder/index")
  const folders = [textFolder.folder]
  const tree = {
    querySelectorAll(selector: string) {
      return selector === ".folder-container[data-folderpath]" ? folders : []
    },
  }
  const payload = JSON.stringify({
    "folder/index": { kind: "text", value: "📁" },
    "masked/index": { kind: "mask", src: "data:image/svg+xml;base64,PHN2Zy8+" },
  })
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
    querySelector(selector: string) {
      if (selector !== "template[data-explorer-folder-icons]") return null
      return {
        getAttribute(name: string) {
          return name === "data-explorer-folder-icons" ? payload : null
        },
      }
    },
    querySelectorAll(selector: string) {
      return selector === ".explorer-ul" ? [tree] : []
    },
    createElement(tagName: string) {
      return createClientElement(tagName)
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
    explorerFolderIconsScript,
  )
  runScript(fakeDocument, fakeWindow, FakeMutationObserver)

  documentListeners.get("nav")?.()
  assert.equal(textFolder.control.children.length, 2)
  const textIcon = textFolder.control.children[0] as ReturnType<typeof createClientElement>
  assert.equal(textIcon.textContent, "📁")
  assert.equal(textIcon.attributes.get("aria-hidden"), "true")
  assert.equal(textIcon.parentElement, textFolder.control)

  documentListeners.get("nav")?.()
  assert.equal(textFolder.control.children.length, 2)
  assert.equal(observers[0].disconnected, true)

  const maskFolder = createFolder("masked/index")
  folders.push(maskFolder.folder)
  observers.at(-1)?.callback()
  assert.equal(maskFolder.control.children.length, 2)
  const maskIcon = maskFolder.control.children[0] as ReturnType<typeof createClientElement>
  assert.match(maskIcon.styleProperties.get("--explorer-folder-icon-url") ?? "", /^url\("data:/)

  cleanup.at(-1)?.()
  assert.equal(observers.at(-1)?.disconnected, true)
  assert.ok(documentListeners.has("render"))
  assert.match(explorerFolderIconsCss, /pointer-events: none/)
})

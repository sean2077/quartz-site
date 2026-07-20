import path from "node:path"
import { h } from "preact"
import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"
import {
  loadExplorerFolderIcons,
  publishedFolderSlugsFromFiles,
  type ExplorerFolderIconLoadResult,
} from "../iconData.ts"

const defaultDataPath = ".obsidian/plugins/obsidian-icon-folder/data.json"
const resultCache = new Map<string, ExplorerFolderIconLoadResult>()
const reportedWarnings = new Set<string>()

export interface ExplorerFolderIconsOptions {
  dataPath?: string
}

export const explorerFolderIconsScript = `
const explorerFolderIconObservers = new WeakMap()

function readExplorerFolderIcons() {
  const payload = document.querySelector("template[data-explorer-folder-icons]")
  const serialized = payload?.getAttribute("data-explorer-folder-icons")
  if (!serialized) return {}

  try {
    return JSON.parse(serialized)
  } catch {
    return {}
  }
}

function createExplorerFolderIcon(spec) {
  let icon
  if (spec.kind === "image") {
    icon = document.createElement("img")
    icon.src = spec.src
    icon.alt = ""
    icon.draggable = false
    icon.className = "explorer-folder-icon explorer-folder-icon-image"
  } else {
    icon = document.createElement("span")
    icon.className = "explorer-folder-icon explorer-folder-icon-" + spec.kind
    if (spec.kind === "text") icon.textContent = spec.value
    if (spec.kind === "mask") {
      icon.style.setProperty("--explorer-folder-icon-url", 'url("' + spec.src + '")')
    }
  }

  icon.setAttribute("aria-hidden", "true")
  return icon
}

function decorateExplorerFolderIcons(tree, icons) {
  tree.querySelectorAll(".folder-container[data-folderpath]").forEach((folder) => {
    const spec = icons[folder.dataset.folderpath]
    if (!spec) return

    const title = folder.querySelector(".folder-title")
    const control = title?.parentElement
    if (!title || !control) return
    if (title.previousElementSibling?.classList.contains("explorer-folder-icon")) return

    control.insertBefore(createExplorerFolderIcon(spec), title)
  })
}

function setupExplorerFolderIcons() {
  const icons = readExplorerFolderIcons()
  const cleanup = []

  document.querySelectorAll(".explorer-ul").forEach((tree) => {
    explorerFolderIconObservers.get(tree)?.disconnect()
    decorateExplorerFolderIcons(tree, icons)

    const observer = new MutationObserver(() => decorateExplorerFolderIcons(tree, icons))
    observer.observe(tree, { childList: true, subtree: true })
    explorerFolderIconObservers.set(tree, observer)
    cleanup.push(() => {
      observer.disconnect()
      explorerFolderIconObservers.delete(tree)
    })
  })

  window.addCleanup(() => cleanup.forEach((dispose) => dispose()))
}

document.addEventListener("nav", setupExplorerFolderIcons)
document.addEventListener("render", setupExplorerFolderIcons)
`

export const explorerFolderIconsCss = `
.explorer .folder-button {
  display: inline-flex;
  align-items: center;
}

.explorer-folder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  margin-right: 4px;
  flex: 0 0 1em;
  line-height: 1;
  pointer-events: none;
}

.explorer-folder-icon-mask {
  background-color: currentColor;
  -webkit-mask-image: var(--explorer-folder-icon-url);
  mask-image: var(--explorer-folder-icon-url);
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.explorer-folder-icon-image {
  object-fit: contain;
}
`

function cacheKey(contentRoot: string, dataPath: string, publishedFolders: ReadonlySet<string>) {
  return JSON.stringify([contentRoot, dataPath, [...publishedFolders].sort()])
}

export function reportExplorerFolderIconWarningsOnce(
  contentRoot: string,
  warnings: readonly string[],
  warn: (message: string) => void = console.warn,
) {
  for (const warning of warnings) {
    const warningKey = `${contentRoot}\0${warning}`
    if (reportedWarnings.has(warningKey)) continue
    reportedWarnings.add(warningKey)
    warn(`[ExplorerFolderIcons] ${warning}`)
  }
}

export const ExplorerFolderIcons: QuartzComponentConstructor<ExplorerFolderIconsOptions> = (
  options,
) => {
  const dataPath = options?.dataPath ?? defaultDataPath

  const ExplorerFolderIconsComponent: QuartzComponent = (props: QuartzComponentProps) => {
    const contentRoot = path.resolve(props.ctx.argv.directory)
    const publishedFolders = publishedFolderSlugsFromFiles(props.allFiles)
    const key = cacheKey(contentRoot, dataPath, publishedFolders)

    let result = resultCache.get(key)
    if (!result) {
      result = loadExplorerFolderIcons({
        contentRoot,
        dataPath,
        publishedFolderSlugs: publishedFolders,
      })
      resultCache.set(key, result)
    }

    reportExplorerFolderIconWarningsOnce(contentRoot, result.warnings)

    if (Object.keys(result.icons).length === 0) return null

    return h("template", {
      "data-explorer-folder-icons": JSON.stringify(result.icons),
    })
  }

  ExplorerFolderIconsComponent.css = explorerFolderIconsCss
  ExplorerFolderIconsComponent.afterDOMLoaded = explorerFolderIconsScript
  return ExplorerFolderIconsComponent
}

import type { QuartzComponent, QuartzComponentConstructor } from "@quartz-community/types"

export const explorerAccessibilityScript = `
function syncExplorerAccessibility(explorer) {
  const expanded = !explorer.classList.contains("collapsed")
  const expandedValue = String(expanded)
  const content = explorer.querySelector(".explorer-content")

  explorer.setAttribute("aria-expanded", expandedValue)
  if (content) {
    content.setAttribute("aria-expanded", expandedValue)
    content.setAttribute("aria-hidden", String(!expanded))
  }

  explorer.querySelectorAll(".explorer-toggle").forEach((button) => {
    button.setAttribute("aria-expanded", expandedValue)
    if (content?.id) button.setAttribute("aria-controls", content.id)
  })
}

function setupExplorerAccessibility() {
  const cleanup = []

  document.querySelectorAll(".explorer").forEach((explorer) => {
    syncExplorerAccessibility(explorer)

    const syncAfterToggle = () => queueMicrotask(() => syncExplorerAccessibility(explorer))
    explorer.querySelectorAll(".explorer-toggle").forEach((button) => {
      button.addEventListener("click", syncAfterToggle)
      cleanup.push(() => button.removeEventListener("click", syncAfterToggle))
    })

    const observer = new MutationObserver(() => syncExplorerAccessibility(explorer))
    observer.observe(explorer, { attributes: true, attributeFilter: ["class"] })
    cleanup.push(() => observer.disconnect())
  })

  window.addCleanup(() => cleanup.forEach((dispose) => dispose()))
}

document.addEventListener("nav", setupExplorerAccessibility)
document.addEventListener("render", setupExplorerAccessibility)
`

const ExplorerAccessibilityComponent: QuartzComponent = () => null
ExplorerAccessibilityComponent.afterDOMLoaded = explorerAccessibilityScript

export const ExplorerAccessibility: QuartzComponentConstructor = () =>
  ExplorerAccessibilityComponent

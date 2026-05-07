import { h, Fragment } from "preact"
import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"

const script = `
function setupMobileToc() {
  const toggleBtn = document.querySelector(".mobile-toc-toggle")
  const closeBtn = document.querySelector(".mobile-toc-close")
  const panel = document.querySelector(".mobile-toc-panel")
  const backdrop = document.querySelector(".mobile-toc-backdrop")
  const backToTopBtn = document.querySelector(".mobile-back-to-top")
  if (!toggleBtn || !panel || !backdrop) return

  const openToc = () => {
    panel.classList.add("active")
    backdrop.classList.add("active")
    document.body.style.overflow = "hidden"
  }
  const closeToc = () => {
    panel.classList.remove("active")
    backdrop.classList.remove("active")
    document.body.style.overflow = ""
  }
  const handleEscape = (e) => {
    if (e.key === "Escape" && panel.classList.contains("active")) closeToc()
  }

  toggleBtn.addEventListener("click", openToc)
  closeBtn?.addEventListener("click", closeToc)
  backdrop.addEventListener("click", closeToc)
  document.addEventListener("keydown", handleEscape)

  const tocLinks = panel.querySelectorAll("a")
  tocLinks.forEach((link) => link.addEventListener("click", closeToc))

  if (backToTopBtn) {
    const handleScroll = () => {
      if (window.scrollY > 300) backToTopBtn.classList.add("visible")
      else backToTopBtn.classList.remove("visible")
    }
    const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" })
    window.addEventListener("scroll", handleScroll, { passive: true })
    backToTopBtn.addEventListener("click", scrollToTop)
    handleScroll()
    window.addCleanup(() => {
      window.removeEventListener("scroll", handleScroll)
      backToTopBtn.removeEventListener("click", scrollToTop)
    })
  }

  window.addCleanup(() => {
    toggleBtn.removeEventListener("click", openToc)
    closeBtn?.removeEventListener("click", closeToc)
    backdrop.removeEventListener("click", closeToc)
    tocLinks.forEach((link) => link.removeEventListener("click", closeToc))
    document.removeEventListener("keydown", handleEscape)
    document.body.style.overflow = ""
  })
}
document.addEventListener("nav", setupMobileToc)
`

const css = `
.mobile-toc-toggle,
.mobile-toc-panel,
.mobile-toc-backdrop,
.mobile-back-to-top {
  display: none;
}
@media all and (max-width: 800px) {
  .mobile-toc-toggle,
  .mobile-back-to-top {
    position: fixed;
    right: 1rem;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    cursor: pointer;
    z-index: 89;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s, visibility 0.2s, background-color 0.2s;
    -webkit-tap-highlight-color: transparent;
    transform: translateZ(0);
    touch-action: manipulation;
  }
  .mobile-toc-toggle svg,
  .mobile-back-to-top svg {
    width: 20px;
    height: 20px;
  }
  .mobile-back-to-top {
    bottom: calc(1rem + 42px + 0.5rem + env(safe-area-inset-bottom, 0px));
    background-color: var(--light);
    border: 1px solid var(--lightgray);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
    opacity: 0;
    visibility: hidden;
  }
  .mobile-back-to-top.visible {
    opacity: 1;
    visibility: visible;
  }
  .mobile-back-to-top svg {
    stroke: var(--darkgray);
    stroke-width: 2.5;
  }
  .mobile-toc-toggle {
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    background-color: var(--dark);
    border: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  .mobile-toc-toggle svg {
    stroke: var(--light);
    stroke-width: 2;
  }
  .mobile-toc-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    background-color: var(--light);
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
    z-index: 95;
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .mobile-toc-panel.active {
    transform: translateY(0);
  }
  .mobile-toc-panel::before {
    content: "";
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 4px;
    background-color: var(--lightgray);
    border-radius: 2px;
  }
  .mobile-toc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1rem 0.75rem;
    flex-shrink: 0;
  }
  .mobile-toc-header h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--darkgray);
    text-transform: uppercase;
  }
  .mobile-toc-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: var(--gray);
    display: flex;
    border-radius: 8px;
  }
  .mobile-toc-close svg {
    width: 18px;
    height: 18px;
  }
  .mobile-toc-content {
    padding: 0.5rem 0.75rem 2rem;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    flex: 1;
    overscroll-behavior: contain;
  }
  .mobile-toc-content ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .mobile-toc-content li {
    margin-bottom: 2px;
  }
  .mobile-toc-content a {
    display: block;
    padding: 0.625rem 0.75rem;
    color: var(--darkgray);
    border-radius: 8px;
    font-size: 0.9rem;
    line-height: 1.4;
    text-decoration: none;
    font-weight: 500;
    -webkit-tap-highlight-color: transparent;
  }
  .mobile-toc-content .depth-0 a {
    font-weight: 600;
    color: var(--dark);
  }
  .mobile-toc-content .depth-1 { padding-left: 0.75rem; }
  .mobile-toc-content .depth-2 { padding-left: 1.5rem; }
  .mobile-toc-content .depth-3 { padding-left: 2.25rem; }
  .mobile-toc-content .depth-4 { padding-left: 3rem; }
  .mobile-toc-content .depth-5 { padding-left: 3.75rem; }
  .mobile-toc-content .depth-6 { padding-left: 4.5rem; }
  .mobile-toc-backdrop {
    position: fixed;
    inset: 0;
    height: 100dvh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 92;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s;
    display: block;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    transform: translateZ(0);
  }
  .mobile-toc-backdrop.active {
    opacity: 1;
    visibility: visible;
  }
}
`

function icon(kind: "up" | "list" | "close") {
  const common = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }

  if (kind === "up") {
    return h("svg", common, h("polyline", { points: "18 15 12 9 6 15" }))
  }
  if (kind === "close") {
    return h(
      "svg",
      common,
      h("line", { x1: 18, y1: 6, x2: 6, y2: 18 }),
      h("line", { x1: 6, y1: 6, x2: 18, y2: 18 }),
    )
  }
  return h(
    "svg",
    common,
    h("line", { x1: 3, y1: 6, x2: 21, y2: 6 }),
    h("line", { x1: 3, y1: 12, x2: 15, y2: 12 }),
    h("line", { x1: 3, y1: 18, x2: 18, y2: 18 }),
  )
}

const MobileTocComponent: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  const toc = (fileData.toc ?? []) as Array<{ slug: string; depth: number; text: string }>
  if (toc.length === 0) return null

  const title = cfg.locale?.startsWith("zh") ? "目录" : "Table of Contents"

  return h(
    Fragment,
    null,
    h("div", { class: "mobile-toc-backdrop" }),
    h("button", { class: "mobile-back-to-top", "aria-label": "Back to top" }, icon("up")),
    h(
      "button",
      { class: "mobile-toc-toggle", "aria-label": "Toggle table of contents" },
      icon("list"),
    ),
    h(
      "div",
      { class: "mobile-toc-panel" },
      h(
        "div",
        { class: "mobile-toc-header" },
        h("h3", null, title),
        h(
          "button",
          { class: "mobile-toc-close", "aria-label": "Close table of contents" },
          icon("close"),
        ),
      ),
      h(
        "div",
        { class: "mobile-toc-content" },
        h(
          "ul",
          null,
          toc.map((entry) =>
            h(
              "li",
              { key: entry.slug, class: `depth-${entry.depth}` },
              h("a", { href: `#${entry.slug}`, "data-for": entry.slug }, entry.text),
            ),
          ),
        ),
      ),
    ),
  )
}

MobileTocComponent.css = css
MobileTocComponent.afterDOMLoaded = script

export const MobileToc: QuartzComponentConstructor = () => MobileTocComponent

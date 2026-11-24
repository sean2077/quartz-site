import { h, Fragment } from "preact"
import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"

export const mobileTocScript = `
function setupMobileToc() {
  const toggleBtn = document.querySelector(".mobile-toc-toggle")
  const closeBtn = document.querySelector(".mobile-toc-close")
  const panel = document.querySelector(".mobile-toc-panel")
  const backToTopBtn = document.querySelector(".mobile-back-to-top")
  if (!toggleBtn || !panel) return

  const mobileViewport = window.matchMedia("(max-width: 800px)")
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let previousOverflow
  const restoreScroll = () => {
    if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow
    previousOverflow = undefined
    toggleBtn.setAttribute("aria-expanded", "false")
  }
  const openToc = () => {
    if (!mobileViewport.matches || panel.open) return
    // Native dialogs provide an inert background, Escape and focus restoration,
    // including when rendered inside a reading surface.
    panel.showModal()
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    toggleBtn.setAttribute("aria-expanded", "true")
  }
  const closeToc = () => {
    if (panel.open) panel.close()
    restoreScroll()
  }
  const closeOnDesktop = () => {
    if (!mobileViewport.matches) closeToc()
  }
  const handleClose = () => {
    if (!panel.open) restoreScroll()
  }
  const closeOnBackdrop = (event) => {
    if (event.target !== panel) return
    const bounds = panel.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeToc()
  }
  const tocLinks = panel.querySelectorAll("a[href]")
  const cycleFocusAtBoundary = (event) => {
    if (!panel.open || event.key !== "Tab" || event.defaultPrevented ||
        event.altKey || event.ctrlKey || event.metaKey) return
    const first = closeBtn ?? tocLinks[0]
    const last = tocLinks[tocLinks.length - 1] ?? closeBtn
    // Keep end-of-list Tab navigation inside the sheet instead of transferring
    // focus to browser chrome. Leave all intermediate navigation native.
    if (event.shiftKey && document.activeElement === first && last) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault()
      first.focus()
    }
  }

  toggleBtn.addEventListener("click", openToc)
  closeBtn?.addEventListener("click", closeToc)
  panel.addEventListener("click", closeOnBackdrop)
  panel.addEventListener("close", handleClose)
  panel.addEventListener("keydown", cycleFocusAtBoundary)
  mobileViewport.addEventListener("change", closeOnDesktop)
  tocLinks.forEach((link) => link.addEventListener("click", closeToc))

  const handleScroll = () => {
    backToTopBtn?.classList.toggle("visible", window.scrollY > 300)
  }
  const scrollToTop = () => window.scrollTo({
    top: 0,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  })
  if (backToTopBtn) {
    window.addEventListener("scroll", handleScroll, { passive: true })
    backToTopBtn.addEventListener("click", scrollToTop)
    handleScroll()
  }

  window.addCleanup(() => {
    closeToc()
    toggleBtn.removeEventListener("click", openToc)
    closeBtn?.removeEventListener("click", closeToc)
    panel.removeEventListener("click", closeOnBackdrop)
    panel.removeEventListener("close", handleClose)
    panel.removeEventListener("keydown", cycleFocusAtBoundary)
    mobileViewport.removeEventListener("change", closeOnDesktop)
    tocLinks.forEach((link) => link.removeEventListener("click", closeToc))
    window.removeEventListener("scroll", handleScroll)
    backToTopBtn?.removeEventListener("click", scrollToTop)
  })
}
document.addEventListener("nav", setupMobileToc)
`

const css = `
.mobile-toc-toggle,
.mobile-toc-panel,
.mobile-back-to-top {
  display: none;
}
@media all and (max-width: 800px) {
  .mobile-toc-toggle,
  .mobile-back-to-top {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right, 0px));
    width: 44px;
    height: 44px;
    border-radius: 12px;
    cursor: pointer;
    z-index: 89;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s, visibility 0.2s, background-color 0.2s;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .mobile-toc-toggle svg,
  .mobile-back-to-top svg {
    width: 20px;
    height: 20px;
  }
  .mobile-back-to-top {
    bottom: calc(1rem + 44px + 0.5rem + env(safe-area-inset-bottom, 0px));
    background-color: var(--light);
    border: 1px solid var(--lightgray);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  .mobile-toc-toggle svg {
    stroke: var(--light);
    stroke-width: 2;
  }
  .mobile-toc-panel {
    position: fixed;
    inset: auto 0 0;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    max-height: 70vh;
    max-height: 70dvh;
    margin: 0;
    padding: 0;
    color: var(--darkgray);
    background-color: var(--light);
    border: 1px solid var(--lightgray);
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    flex-direction: column;
  }
  .mobile-toc-panel[open] {
    display: flex;
    animation: mobile-toc-enter 0.2s ease-out;
  }
  .mobile-toc-panel::backdrop {
    background-color: rgba(0, 0, 0, 0.45);
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
    padding: 1rem 1rem 0.5rem;
    flex-shrink: 0;
  }
  .mobile-toc-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--dark);
  }
  .mobile-toc-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    color: var(--darkgray);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 8px;
  }
  .mobile-toc-close svg {
    width: 18px;
    height: 18px;
  }
  .mobile-toc-content {
    padding: 0.5rem 0.75rem calc(1rem + env(safe-area-inset-bottom, 0px));
    overflow-y: auto;
    min-height: 0;
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
    box-sizing: border-box;
    min-height: 44px;
    display: block;
    padding: 0.625rem 0.75rem;
    color: var(--darkgray);
    border-radius: 8px;
    font-size: 0.95rem;
    line-height: 1.5;
    text-decoration: none;
    font-weight: 500;
    -webkit-tap-highlight-color: transparent;
  }
  .mobile-toc-content a:hover {
    background: var(--highlight);
  }
  .mobile-toc-content .depth-0 a {
    font-weight: 600;
    color: var(--secondary);
  }
  .mobile-toc-content .depth-1 { padding-left: 0.75rem; }
  .mobile-toc-content .depth-2 { padding-left: 1.5rem; }
  .mobile-toc-content .depth-3 { padding-left: 2.25rem; }
  .mobile-toc-content .depth-4 { padding-left: 3rem; }
  .mobile-toc-content .depth-5 { padding-left: 3.75rem; }
  .mobile-toc-content .depth-6 { padding-left: 4.5rem; }
}
@keyframes mobile-toc-enter {
  from { transform: translateY(1rem); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .mobile-toc-panel[open] { animation: none; }
  .mobile-toc-toggle, .mobile-back-to-top { transition: none; }
}
@media print {
  .mobile-toc-toggle, .mobile-toc-panel, .mobile-back-to-top { display: none; }
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
    "aria-hidden": "true",
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

  const isChinese = cfg.locale?.startsWith("zh")
  const title = isChinese ? "目录" : "Table of Contents"

  return h(
    Fragment,
    null,
    h(
      "button",
      {
        type: "button",
        class: "mobile-back-to-top",
        "aria-label": isChinese ? "返回顶部" : "Back to top",
      },
      icon("up"),
    ),
    h(
      "button",
      {
        type: "button",
        class: "mobile-toc-toggle",
        "aria-label": isChinese ? "打开目录" : "Open table of contents",
        "aria-controls": "mobile-toc-panel",
        "aria-expanded": "false",
        "aria-haspopup": "dialog",
      },
      icon("list"),
    ),
    h(
      "dialog",
      {
        id: "mobile-toc-panel",
        class: "mobile-toc-panel",
        "aria-labelledby": "mobile-toc-title",
      },
      h(
        "div",
        { class: "mobile-toc-header" },
        h("h3", { id: "mobile-toc-title" }, title),
        h(
          "button",
          {
            type: "button",
            class: "mobile-toc-close",
            autofocus: true,
            "aria-label": isChinese ? "关闭目录" : "Close table of contents",
          },
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
MobileTocComponent.afterDOMLoaded = mobileTocScript

export const MobileToc: QuartzComponentConstructor = () => MobileTocComponent

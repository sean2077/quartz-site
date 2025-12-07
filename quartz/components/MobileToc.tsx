import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { i18n } from "../i18n"

// @ts-ignore
import script from "./scripts/mobileToc.inline"
import style from "./styles/mobileToc.scss"

/**
 * Mobile Table of Contents Component
 *
 * Displays a floating button that opens a bottom sheet with the table of contents
 * Only visible on mobile devices
 */
const MobileToc: QuartzComponent = ({ fileData, cfg }: QuartzComponentProps) => {
  if (!fileData.toc || fileData.toc.length === 0) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div class="mobile-toc-backdrop" />

      {/* Back to top button */}
      <button class="mobile-back-to-top" aria-label="Back to top">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {/* Floating toggle button */}
      <button class="mobile-toc-toggle" aria-label="Toggle table of contents">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="3" y1="18" x2="18" y2="18" />
        </svg>
      </button>

      {/* TOC Panel */}
      <div class="mobile-toc-panel">
        <div class="mobile-toc-header">
          <h3>{i18n(cfg.locale).components.tableOfContents.title}</h3>
          <button class="mobile-toc-close" aria-label="Close table of contents">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="mobile-toc-content">
          <ul>
            {fileData.toc.map((tocEntry) => (
              <li key={tocEntry.slug} class={`depth-${tocEntry.depth}`}>
                <a href={`#${tocEntry.slug}`} data-for={tocEntry.slug}>
                  {tocEntry.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}

MobileToc.css = style
MobileToc.afterDOMLoaded = script

export default (() => MobileToc) satisfies QuartzComponentConstructor

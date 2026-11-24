import { h } from "preact"
import type { QuartzComponent, QuartzComponentConstructor } from "@quartz-community/types"

// This clock belongs to the document, not to an individual SPA page. Keep one
// boundary timer, suspend it in the background, and resume after a bfcache restore.
export const dynamicBackgroundScript = `
let phaseTimer

function stopPhaseClock() {
  window.clearTimeout(phaseTimer)
}

function updateTimePhase() {
  stopPhaseClock()
  const now = new Date()
  const hour = now.getHours()
  const phase = hour < 5 ? "night"
    : hour < 7 ? "dawn"
    : hour < 12 ? "morning"
    : hour < 14 ? "noon"
    : hour < 17 ? "afternoon"
    : hour < 19 ? "dusk" : "night"
  document.documentElement.setAttribute("data-time-phase", phase)
  if (document.hidden) return

  const next = new Date(now)
  next.setHours([5, 7, 12, 14, 17, 19, 29].find((boundary) => boundary > hour), 0, 0, 0)
  phaseTimer = window.setTimeout(updateTimePhase, next.getTime() - now.getTime())
}

document.addEventListener("visibilitychange", updateTimePhase)
window.addEventListener("pagehide", stopPhaseClock)
window.addEventListener("pageshow", updateTimePhase)
updateTimePhase()
`

const phases = ["dawn", "morning", "noon", "afternoon", "dusk", "night"]
const imageRules = (width: number) =>
  phases
    .map(
      (phase) => `
:root[data-time-phase="${phase}"] .dynamic-background {
  background-image: url("./static/A day in the corner of the city/${phase}-${width}.webp");
}`,
    )
    .join("\n")

const css = `
.dynamic-background {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.dynamic-background::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(180, 175, 165, 0.3);
}
:root[saved-theme="dark"] .dynamic-background::after {
  background: rgba(24, 24, 30, 0.45);
}
${imageRules(1600)}
@media (max-width: 800px) {
  ${imageRules(800)}
}
@media print {
  .dynamic-background { display: none; }
}
`

const DynamicBackgroundComponent: QuartzComponent = () =>
  h("div", { class: "dynamic-background", "aria-hidden": "true" })

DynamicBackgroundComponent.beforeDOMLoaded = dynamicBackgroundScript
DynamicBackgroundComponent.css = css

export const DynamicBackground: QuartzComponentConstructor = () => DynamicBackgroundComponent

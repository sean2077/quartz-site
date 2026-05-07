import { h } from "preact"
import type { QuartzComponent, QuartzComponentConstructor } from "@quartz-community/types"

const script = `
function getTimePhase() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 7) return "dawn"
  if (hour >= 7 && hour < 12) return "morning"
  if (hour >= 12 && hour < 14) return "noon"
  if (hour >= 14 && hour < 17) return "afternoon"
  if (hour >= 17 && hour < 19) return "dusk"
  return "night"
}
document.documentElement.setAttribute("data-time-phase", getTimePhase())
setInterval(() => {
  const next = getTimePhase()
  const current = document.documentElement.getAttribute("data-time-phase")
  if (next !== current) document.documentElement.setAttribute("data-time-phase", next)
}, 60000)
`

const css = `
.dynamic-background {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  z-index: -1;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: background-image 1.5s ease-in-out;
  transform: translateZ(0);
}
.dynamic-background::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(180, 175, 165, 0.38);
  transition: background 0.3s ease;
}
:root[data-time-phase="dawn"] .dynamic-background {
  background-image: url("/static/A day in the corner of the city/dawn.png");
}
:root[data-time-phase="morning"] .dynamic-background {
  background-image: url("/static/A day in the corner of the city/morning.png");
}
:root[data-time-phase="noon"] .dynamic-background {
  background-image: url("/static/A day in the corner of the city/noon.jpg");
}
:root[data-time-phase="afternoon"] .dynamic-background {
  background-image: url("/static/A day in the corner of the city/afternoon.png");
}
:root[data-time-phase="dusk"] .dynamic-background {
  background-image: url("/static/A day in the corner of the city/dusk.jpg");
}
:root[data-time-phase="night"] .dynamic-background {
  background-image: url("/static/A day in the corner of the city/night.jpg");
}
body {
  font-weight: 500;
}
.page > #quartz-body > .sidebar {
  padding-top: 1rem !important;
  background: color-mix(in srgb, var(--light) 50%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.page > #quartz-body .page-header {
  margin: 1rem 0 0 0 !important;
}
.center {
  padding: 0.5rem 1rem 0;
  background: color-mix(in srgb, var(--light) 65%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}
pre {
  background: color-mix(in srgb, var(--lightgray) 30%, transparent) !important;
  backdrop-filter: blur(3px);
  border: none;
  border-left: 3px solid var(--secondary);
  border-radius: 0 5px 5px 0;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lightgray) 50%, transparent);
}
code:not(pre code) {
  background: color-mix(in srgb, var(--lightgray) 40%, transparent) !important;
  border: 1px solid color-mix(in srgb, var(--lightgray) 60%, transparent);
}
article h1,
article h2 {
  color: var(--secondary);
}
article h3 {
  color: #059669;
}
article h4 {
  color: #d97706;
}
.toc .depth-0 > a {
  color: var(--secondary) !important;
}
.toc .depth-1 > a {
  color: #059669 !important;
}
.toc .depth-2 > a {
  color: #d97706 !important;
}
:root[saved-theme="dark"] .dynamic-background::after {
  background: rgba(31, 30, 30, 0.38);
}
:root[saved-theme="dark"] .center {
  background: color-mix(in srgb, var(--light) 70%, transparent);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
}
:root[saved-theme="dark"] .sidebar {
  background: color-mix(in srgb, var(--light) 55%, transparent);
}
:root[saved-theme="dark"] article h3 {
  color: #34d399;
}
:root[saved-theme="dark"] article h4 {
  color: #fbbf24;
}
@media (min-width: 1200px) {
  .page {
    max-width: 100% !important;
    padding: 0 !important;
  }
  .page > #quartz-body {
    grid-template-columns: 280px 1fr 280px !important;
    column-gap: 0.25rem !important;
  }
  .page > #quartz-body > .center {
    box-sizing: border-box !important;
    width: 100% !important;
    padding: 0.5rem 1.5rem 0;
  }
}
@media (min-width: 1800px) {
  .page {
    max-width: 1800px !important;
    margin: 0 auto !important;
  }
}
`

const DynamicBackgroundComponent: QuartzComponent = () => h("div", { class: "dynamic-background" })

DynamicBackgroundComponent.beforeDOMLoaded = script
DynamicBackgroundComponent.css = css

export const DynamicBackground: QuartzComponentConstructor = () => DynamicBackgroundComponent

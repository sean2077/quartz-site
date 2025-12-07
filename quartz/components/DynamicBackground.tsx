// @ts-ignore
import dynamicBgScript from "./scripts/dynamicBackground.inline"
import styles from "./styles/dynamicBackground.scss"
import { QuartzComponent, QuartzComponentConstructor } from "./types"

const DynamicBackground: QuartzComponent = () => {
  return <div class="dynamic-background" />
}

DynamicBackground.beforeDOMLoaded = dynamicBgScript
DynamicBackground.css = styles

export default (() => DynamicBackground) satisfies QuartzComponentConstructor

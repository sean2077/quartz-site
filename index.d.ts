declare module "*.scss" {
  const content: string
  export = content
}

// micromorph 0.4.x ships this declaration but omits it from its exports map.
// Keep its actual public signature visible under bundler module resolution.
declare module "micromorph" {
  export default function micromorph(from: Node, to: Node): Promise<void>
}

// dom custom event
interface CustomEventMap {
  prenav: CustomEvent<{}>
  nav: CustomEvent<{ url: FullSlug }>
  themechange: CustomEvent<{ theme: "light" | "dark" }>
  readermodechange: CustomEvent<{ mode: "on" | "off" }>
  render: CustomEvent<{}>
}

type ContentIndex = Record<FullSlug, ContentDetails>
declare const fetchData: Promise<ContentIndex>

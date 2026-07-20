import { h } from "preact"
import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types"

export interface FooterOptions {
  creditText: string
  creditUrl: string
  links: Record<string, string>
}

const defaultOptions: FooterOptions = {
  creditText: "Quartz — sean2077 fork",
  creditUrl: "https://github.com/sean2077/quartz-site",
  links: {},
}

const css = `
footer {
  text-align: left;
  margin-bottom: 4rem;
  opacity: 0.7;
}
footer ul {
  list-style: none;
  margin: -1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: row;
  gap: 1rem;
}
`

export const Footer = ((opts?: Partial<FooterOptions>) => {
  const options: FooterOptions = {
    ...defaultOptions,
    ...opts,
    links: opts?.links ?? defaultOptions.links,
  }

  const FooterComponent: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const year = new Date().getFullYear()

    return h(
      "footer",
      { class: displayClass ?? "" },
      h(
        "p",
        null,
        "Created with ",
        h("a", { href: options.creditUrl }, options.creditText),
        ` © ${year}`,
      ),
      h(
        "ul",
        null,
        Object.entries(options.links).map(([text, link]) =>
          h("li", { key: text }, h("a", { href: link }, text)),
        ),
      ),
    )
  }

  FooterComponent.css = css
  return FooterComponent
}) satisfies QuartzComponentConstructor<Partial<FooterOptions>>

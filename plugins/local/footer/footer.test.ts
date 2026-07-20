import assert from "node:assert/strict"
import test from "node:test"
import type { VNode } from "preact"
import renderToString from "preact-render-to-string"
import type { QuartzComponentProps } from "@quartz-community/types"
import { Footer } from "./components"

test("renders the fork attribution and preserves the configured links", () => {
  const component = Footer({
    creditText: "Quartz — sean2077 fork",
    creditUrl: "https://github.com/sean2077/quartz-site",
    links: {
      GitHub: "https://github.com/sean2077/",
      Email: "mailto:seanzhang.dev@gmail.com",
      RSS: "/index.xml",
    },
  })
  const html = renderToString(component({} as QuartzComponentProps) as VNode)

  assert.ok(
    html.includes(
      'Created with <a href="https://github.com/sean2077/quartz-site">Quartz — sean2077 fork</a>',
    ),
  )
  assert.ok(html.includes(`© ${new Date().getFullYear()}`))
  assert.ok(html.includes('<a href="https://github.com/sean2077/">GitHub</a>'))
  assert.ok(html.includes('<a href="mailto:seanzhang.dev@gmail.com">Email</a>'))
  assert.ok(html.includes('<a href="/index.xml">RSS</a>'))
  assert.ok(!html.includes("quartz.jzhao.xyz"))
})

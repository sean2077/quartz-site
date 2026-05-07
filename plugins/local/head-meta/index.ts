import { h } from "preact"
import type { QuartzTransformerPlugin } from "@quartz-community/types"

export const HeadMeta: QuartzTransformerPlugin = () => ({
  name: "HeadMeta",
  textTransform(_ctx, src) {
    return src
  },
  externalResources(ctx) {
    const verification = (ctx.cfg.configuration as { googleSiteVerification?: string })
      .googleSiteVerification

    if (!verification) return undefined

    return {
      additionalHead: [
        () => h("meta", { name: "google-site-verification", content: verification }),
      ],
    }
  },
})

export default HeadMeta

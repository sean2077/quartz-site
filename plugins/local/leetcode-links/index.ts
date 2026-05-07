import type { QuartzTransformerPlugin } from "@quartz-community/types"

const leetcodeWikiLinkRegex = /\[\[((?:\d+|LCP \d+)\.[^\|\]]+)\|([^\]]+)\]\]/g

export function convertLeetCodeLinks(src: string): string {
  return src.replace(leetcodeWikiLinkRegex, (_match, fullSlug: string, displayText: string) => {
    const dotIndex = fullSlug.indexOf(".")
    const slug = fullSlug.substring(dotIndex + 1)
    return `[${displayText}](https://leetcode.com/problems/${slug}/)`
  })
}

export const LeetCodeLinks: QuartzTransformerPlugin = () => ({
  name: "LeetCodeLinks",
  textTransform(_ctx, src) {
    return convertLeetCodeLinks(src)
  },
})

export default LeetCodeLinks

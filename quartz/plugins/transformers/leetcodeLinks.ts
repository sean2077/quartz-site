import { QuartzTransformerPlugin } from "../types"

// Matches wiki-links with format:
// [[NUMBER.slug|text]] or [[LCP NUMBER.slug|text]]
const leetcodeWikiLinkRegex = /\[\[((?:\d+|LCP \d+)\.[^\|\]]+)\|([^\]]+)\]\]/g

/**
 * Extracts the slug from a LeetCode problem reference.
 * @param fullSlug - e.g., "207.course-schedule" or "LCP 01.guess-numbers"
 * @returns The slug part - e.g., "course-schedule" or "guess-numbers"
 */
function extractSlug(fullSlug: string): string {
  const dotIndex = fullSlug.indexOf(".")
  return fullSlug.substring(dotIndex + 1)
}

/**
 * Converts Obsidian wiki-links pointing to LeetCode problems into
 * external links to leetcode.com.
 *
 * Transforms:
 *   [[207.course-schedule|LeetCode 207. 课程表]]
 * Into:
 *   [LeetCode 207. 课程表](https://leetcode.com/problems/course-schedule/)
 *
 * Must run BEFORE ObsidianFlavoredMarkdown plugin to intercept wiki-links.
 */
export const LeetCodeLinks: QuartzTransformerPlugin = () => {
  return {
    name: "LeetCodeLinks",
    textTransform(_ctx, src) {
      return src.replace(leetcodeWikiLinkRegex, (_match, fullSlug, displayText) => {
        const slug = extractSlug(fullSlug)
        const url = `https://leetcode.com/problems/${slug}/`
        return `[${displayText}](${url})`
      })
    },
  }
}

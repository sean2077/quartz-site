import type { QuartzTransformerPlugin } from "@quartz-community/types"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { parse as parseYaml } from "yaml"

const leetcodeWikiLinkRegex = /\[\[((?:\d+|LCP \d+)\.[^\|\]]+)\|([^\]]+)\]\]/g
const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/
const leetcodeProblemTag = "leetcode/problem"
const leetcodeProblemUrlPrefix = "https://leetcode.com/problems/"
const leetcodeProblemsRelativeDir = path.join("1Y LeetCode", "lc-problems")
const problemIndexCache = new Map<string, ReadonlyMap<string, string>>()

type LeetCodeCardFrontmatter = {
  tags?: unknown
  questionId?: unknown
  titleSlug?: unknown
  lcLinks?: unknown
}

function hasLeetCodeProblemTag(tags: unknown): boolean {
  if (Array.isArray(tags)) {
    return tags.some((tag) => String(tag).replace(/^#/, "") === leetcodeProblemTag)
  }

  if (typeof tags === "string") {
    return tags
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, ""))
      .includes(leetcodeProblemTag)
  }

  return false
}

function getFrontmatter(src: string): LeetCodeCardFrontmatter | null {
  const match = src.match(frontmatterRegex)
  if (match === null) {
    return null
  }

  const parsed = parseYaml(match[1]) as unknown
  if (typeof parsed !== "object" || parsed === null) {
    return null
  }

  return parsed as LeetCodeCardFrontmatter
}

function getProblemUrl(frontmatter: LeetCodeCardFrontmatter): string | null {
  if (Array.isArray(frontmatter.lcLinks)) {
    const officialUrl = frontmatter.lcLinks.find(
      (link): link is string =>
        typeof link === "string" && link.startsWith(leetcodeProblemUrlPrefix),
    )

    if (officialUrl !== undefined) {
      return officialUrl
    }
  }

  if (typeof frontmatter.titleSlug === "string" && frontmatter.titleSlug.length > 0) {
    return `${leetcodeProblemUrlPrefix}${frontmatter.titleSlug}/`
  }

  return null
}

function addProblemTarget(
  index: Map<string, string>,
  target: string | undefined,
  problemUrl: string,
) {
  if (target !== undefined && target.length > 0) {
    index.set(target, problemUrl)
  }
}

function normalizeWikiTarget(target: string): string {
  return target.endsWith("\\") ? target.slice(0, -1) : target
}

function* markdownFiles(rootDir: string): Generator<string> {
  if (!existsSync(rootDir)) {
    return
  }

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      yield* markdownFiles(entryPath)
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      yield entryPath
    }
  }
}

export function buildLeetCodeProblemIndex(
  problemsDir: string,
  contentDir = path.dirname(path.dirname(problemsDir)),
): ReadonlyMap<string, string> {
  const index = new Map<string, string>()

  for (const filePath of markdownFiles(problemsDir)) {
    const frontmatter = getFrontmatter(readFileSync(filePath, "utf-8"))
    if (frontmatter === null || !hasLeetCodeProblemTag(frontmatter.tags)) {
      continue
    }

    const problemUrl = getProblemUrl(frontmatter)
    if (problemUrl === null) {
      continue
    }

    const fileTarget = path.basename(filePath, ".md")
    const relativeTarget = path.relative(contentDir, filePath).replace(/\\/g, "/").slice(0, -3)
    addProblemTarget(index, fileTarget, problemUrl)
    addProblemTarget(index, relativeTarget, problemUrl)

    if (typeof frontmatter.questionId === "string" && typeof frontmatter.titleSlug === "string") {
      addProblemTarget(index, `${frontmatter.questionId}.${frontmatter.titleSlug}`, problemUrl)
    }
  }

  return index
}

function getLeetCodeProblemIndex(contentDir: string): ReadonlyMap<string, string> {
  const cached = problemIndexCache.get(contentDir)
  if (cached !== undefined) {
    return cached
  }

  const index = buildLeetCodeProblemIndex(
    path.join(contentDir, leetcodeProblemsRelativeDir),
    contentDir,
  )
  problemIndexCache.set(contentDir, index)
  return index
}

export function convertLeetCodeLinks(
  src: string,
  problemIndex: ReadonlyMap<string, string> = new Map(),
): string {
  return src.replace(leetcodeWikiLinkRegex, (match, fullSlug: string, displayText: string) => {
    const problemUrl = problemIndex.get(normalizeWikiTarget(fullSlug))
    if (problemUrl === undefined) {
      return match
    }

    return `[${displayText}](${problemUrl})`
  })
}

export const LeetCodeLinks: QuartzTransformerPlugin = () => ({
  name: "LeetCodeLinks",
  textTransform(ctx, src) {
    return convertLeetCodeLinks(src, getLeetCodeProblemIndex(ctx.argv.directory))
  },
})

export default LeetCodeLinks

import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import type { Element, Root } from "hast"
import type { QuartzTransformerPlugin } from "@quartz-community/types"
import type { FilePath, FullSlug, RelativeURL, SimpleSlug } from "@quartz-community/utils"
import { resolveRelative, simplifySlug, slugifyFilePath } from "@quartz-community/utils"
import { visit } from "unist-util-visit"
import { parse as parseYaml } from "yaml"

const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/
const publishedSlugCache = new Map<string, ReadonlySet<FullSlug>>()

type PublishFrontmatter = {
  publish?: unknown
}

function isExternalOrAnchor(href: string): boolean {
  return (
    href.startsWith("#") ||
    /^[a-z][a-z\d+.-]*:/i.test(href) ||
    href.startsWith("//") ||
    href.startsWith("data:")
  )
}

function slugDir(slug: string): string {
  if (slug === "index") return ""
  if (slug.endsWith("/index")) return slug.slice(0, -"/index".length)

  const lastSlash = slug.lastIndexOf("/")
  return lastSlash === -1 ? "" : slug.slice(0, lastSlash)
}

function joinSlug(...segments: string[]): FullSlug {
  return segments.filter((segment) => segment.length > 0).join("/") as FullSlug
}

function ancestorDirs(dir: string): string[] {
  if (dir.length === 0) return [""]

  const parts = dir.split("/")
  const dirs: string[] = []
  for (let length = parts.length; length >= 0; length--) {
    dirs.push(parts.slice(0, length).join("/"))
  }
  return dirs
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

function* markdownFiles(rootDir: string): Generator<string> {
  if (!existsSync(rootDir)) return

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      yield* markdownFiles(entryPath)
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      yield entryPath
    }
  }
}

function getFrontmatter(filePath: string): PublishFrontmatter {
  const src = readFileSync(filePath, "utf8")
  const match = frontmatterRegex.exec(src)
  if (match === null) return {}

  try {
    const parsed = parseYaml(match[1]) as PublishFrontmatter | null
    return parsed ?? {}
  } catch {
    return {}
  }
}

function isPublished(frontmatter: PublishFrontmatter): boolean {
  return frontmatter.publish === true || frontmatter.publish === "true"
}

function addAncestorFolderPages(slugs: Set<FullSlug>, slug: FullSlug): void {
  const dir = slugDir(slug)
  if (dir.length === 0) return

  for (const ancestor of ancestorDirs(dir)) {
    if (ancestor.length > 0) {
      slugs.add(joinSlug(ancestor, "index"))
    }
  }
}

export function buildPublishedSlugSet(
  contentDir: string,
  allFiles?: readonly FilePath[],
): ReadonlySet<FullSlug> {
  const slugs = new Set<FullSlug>()
  const relativePaths =
    allFiles === undefined
      ? [...markdownFiles(contentDir)].map((filePath) =>
          path.relative(contentDir, filePath).split(path.sep).join("/"),
        )
      : allFiles.map(String).filter((filePath) => filePath.endsWith(".md"))

  for (const relativePath of relativePaths) {
    const filePath = path.join(contentDir, relativePath)
    if (!isPublished(getFrontmatter(filePath))) continue

    const slug = slugifyFilePath(relativePath as FilePath)
    slugs.add(slug)
    addAncestorFolderPages(slugs, slug)
  }

  return slugs
}

function getPublishedSlugSet(
  contentDir: string,
  allFiles: readonly FilePath[],
): ReadonlySet<FullSlug> {
  const cacheKey = `${path.resolve(contentDir)}\0${allFiles.join("\0")}`
  const cached = publishedSlugCache.get(cacheKey)
  if (cached !== undefined) return cached

  const slugs = buildPublishedSlugSet(contentDir, allFiles)
  publishedSlugCache.set(cacheKey, slugs)
  return slugs
}

function slugExists(slugs: ReadonlySet<FullSlug>, slug: FullSlug): boolean {
  if (slugs.has(slug)) return true
  return slugs.has(joinSlug(slug.replace(/\/index$/, ""), "index"))
}

function folderNoteCandidates(currentSlug: FullSlug, targetSlug: FullSlug): FullSlug[] {
  const target = targetSlug.replace(/\/index$/, "")
  const targetParts = target.split("/").filter(Boolean)
  const candidates: FullSlug[] = []

  if (targetParts.length > 1) {
    candidates.push(joinSlug(target, "index"))
  } else if (targetParts.length === 1) {
    for (const dir of ancestorDirs(slugDir(currentSlug))) {
      candidates.push(joinSlug(dir, target, "index"))
    }
  }

  return unique(candidates)
}

export function resolveFolderNoteLink(
  currentSlug: FullSlug,
  targetSlug: FullSlug,
  publishedSlugs: ReadonlySet<FullSlug>,
): FullSlug | undefined {
  if (slugExists(publishedSlugs, targetSlug)) return undefined

  const matches = folderNoteCandidates(currentSlug, targetSlug).filter((candidate) =>
    publishedSlugs.has(candidate),
  )
  if (matches.length === 1) return matches[0]

  return undefined
}

function hasUnpublishedFolderNoteCandidate(
  currentSlug: FullSlug,
  targetSlug: FullSlug,
  allSlugs: readonly FullSlug[],
  publishedSlugs: ReadonlySet<FullSlug>,
): boolean {
  const allSlugSet = new Set(allSlugs)
  return folderNoteCandidates(currentSlug, targetSlug).some(
    (candidate) => allSlugSet.has(candidate) && !publishedSlugs.has(candidate),
  )
}

function rewriteLinksField(links: unknown, from: FullSlug, to: FullSlug): SimpleSlug[] | undefined {
  if (!Array.isArray(links)) return undefined

  const fromSimple = simplifySlug(from)
  const toSimple = simplifySlug(to)
  const rewritten = links.map((link) => (link === fromSimple ? toSimple : link))
  return unique(rewritten) as SimpleSlug[]
}

export function rewriteFolderNoteLinks(
  tree: Root,
  currentSlug: FullSlug,
  allSlugs: readonly FullSlug[],
  publishedSlugs: ReadonlySet<FullSlug>,
  links?: unknown,
): { rewrites: number; links?: SimpleSlug[] } {
  let rewrites = 0
  let rewrittenLinks = links

  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") return

    const href = node.properties?.href
    const dataSlug = node.properties?.["data-slug"]
    if (typeof href !== "string" || typeof dataSlug !== "string") return
    if (isExternalOrAnchor(href)) return

    const target = dataSlug as FullSlug
    const resolved = resolveFolderNoteLink(currentSlug, target, publishedSlugs)
    if (resolved === undefined) {
      if (hasUnpublishedFolderNoteCandidate(currentSlug, target, allSlugs, publishedSlugs)) {
        node.tagName = "span"
        delete node.properties.href
        delete node.properties["data-slug"]
        rewrittenLinks = rewriteLinksField(rewrittenLinks, target, target)?.filter(
          (link) => link !== simplifySlug(target),
        )
        rewrites++
      }
      return
    }

    node.properties.href = resolveRelative(currentSlug, resolved) as RelativeURL
    node.properties["data-slug"] = resolved
    rewrittenLinks = rewriteLinksField(rewrittenLinks, target, resolved) ?? rewrittenLinks
    rewrites++
  })

  return {
    rewrites,
    links: Array.isArray(rewrittenLinks) ? (rewrittenLinks as SimpleSlug[]) : undefined,
  }
}

export const FolderNoteLinks: QuartzTransformerPlugin = () => ({
  name: "FolderNoteLinks",
  htmlPlugins(ctx) {
    return [
      () => {
        return (tree: Root, file) => {
          const currentSlug = file.data.slug as FullSlug | undefined
          if (currentSlug === undefined) return

          const result = rewriteFolderNoteLinks(
            tree,
            currentSlug,
            ctx.allSlugs,
            getPublishedSlugSet(ctx.argv.directory, ctx.allFiles),
            file.data.links,
          )
          if (result.links !== undefined) {
            file.data.links = result.links
          }
        }
      },
    ]
  },
})

export default FolderNoteLinks

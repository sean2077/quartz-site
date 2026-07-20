import path from "node:path"
import type { Root } from "hast"
import { visit } from "unist-util-visit"
import type { FilePath, FullSlug, QuartzTransformerPlugin } from "@quartz-community/types"
import { resolveRelative, slugifyFilePath } from "@quartz-community/utils"
import { getAllAssets, resolveAsset } from "../on-demand-assets/index.ts"

interface Options {
  extensions?: string[]
}

const defaultOptions: Options = {
  extensions: [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".svg",
    ".webp",
    ".ico",
    ".avif",
    ".mp4",
    ".webm",
    ".ogv",
    ".mov",
    ".mkv",
    ".avi",
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".flac",
    ".aac",
    ".pdf",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
  ],
}

export function isLocalAsset(url: string, extensions: Set<string>): boolean {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return false
  }
  if (url.startsWith("data:")) {
    return false
  }

  const ext = path.extname(url).toLowerCase().split("?")[0]
  return extensions.has(ext)
}

export function normalizeAssetPath(url: string): string {
  let normalized = url.split("?")[0].split("#")[0]
  try {
    normalized = decodeURIComponent(normalized)
  } catch {}

  return normalized.startsWith("/") ? normalized.slice(1) : normalized
}

function assetUrlSuffix(url: string): string {
  const suffixIndex = url.search(/[?#]/)
  return suffixIndex === -1 ? "" : url.slice(suffixIndex)
}

export function resolveAssetReference(
  currentSlug: FullSlug,
  url: string,
  assetMap: Map<string, FilePath>,
): { source: FilePath; url: string } | undefined {
  const source = resolveAsset(normalizeAssetPath(url), assetMap)
  if (source === undefined) return undefined

  const emittedPath = slugifyFilePath(source)
  return {
    source,
    url: `${resolveRelative(currentSlug, emittedPath)}${assetUrlSuffix(url)}`,
  }
}

function missingAssetText(node: { properties?: Record<string, unknown> }, url: string): string {
  const alt = node.properties?.alt
  if (typeof alt === "string" && alt.trim().length > 0) return alt
  return `[missing asset: ${path.posix.basename(normalizeAssetPath(url))}]`
}

export const CollectAssets: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  const extensionSet = new Set(opts.extensions?.map((ext) => ext.toLowerCase()) ?? [])

  return {
    name: "CollectAssets",
    htmlPlugins(ctx) {
      const assetMapPromise = getAllAssets(ctx.argv, ctx.cfg)

      return [
        () => {
          return async (tree: Root, file) => {
            const assetMap = await assetMapPromise
            const currentSlug = file.data.slug as FullSlug
            const assets = new Set<string>()
            const missingAssets = new Set<string>()

            visit(tree, "element", (node) => {
              const originalTagName = node.tagName
              const props = node.properties ?? {}
              node.properties = props
              let lastMissingAsset: string | undefined

              const rewrite = (property: string): boolean => {
                const value = props[property]
                if (typeof value !== "string" || !isLocalAsset(value, extensionSet)) return true

                const resolved = resolveAssetReference(currentSlug, value, assetMap)
                if (resolved === undefined) {
                  lastMissingAsset = normalizeAssetPath(value)
                  missingAssets.add(lastMissingAsset)
                  delete props[property]
                  return false
                }

                props[property] = resolved.url
                assets.add(resolved.source)
                return true
              }

              let primaryAssetResolved = true
              let missingPrimaryAsset: string | undefined
              if (["img", "video", "audio", "source", "iframe"].includes(node.tagName)) {
                primaryAssetResolved = rewrite("src")
                if (!primaryAssetResolved) missingPrimaryAsset = lastMissingAsset
              }
              if (node.tagName === "object") {
                primaryAssetResolved = rewrite("data")
                if (!primaryAssetResolved) missingPrimaryAsset = lastMissingAsset
              }
              if (node.tagName === "video") rewrite("poster")
              rewrite("dataSrc")

              if (node.tagName === "a") {
                const href = props.href
                if (typeof href === "string" && isLocalAsset(href, extensionSet)) {
                  primaryAssetResolved = rewrite("href")
                  if (!primaryAssetResolved) missingPrimaryAsset = lastMissingAsset
                }
              }

              if (!primaryAssetResolved && node.tagName !== "source") {
                const missingUrl = missingPrimaryAsset ?? "unknown"
                const text = missingAssetText(node, missingUrl)
                node.tagName = "span"
                node.properties = {
                  className: ["missing-asset"],
                  "data-missing-asset": missingUrl,
                }
                if (node.children.length === 0 || originalTagName !== "a") {
                  node.children = [{ type: "text", value: text }]
                }
              }
            })

            file.data.assets = [...assets]
            if (missingAssets.size > 0) {
              const source = file.data.relativePath ?? file.path
              console.warn(
                `Warning: unresolved local asset(s) in ${source}: ${[...missingAssets].join(", ")}`,
              )
            }
          }
        },
      ]
    },
  }
}

export default CollectAssets

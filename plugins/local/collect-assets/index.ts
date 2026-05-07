import path from "node:path"
import type { Root } from "hast"
import { visit } from "unist-util-visit"
import type { QuartzTransformerPlugin } from "@quartz-community/types"

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

export const CollectAssets: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  const extensionSet = new Set(opts.extensions?.map((ext) => ext.toLowerCase()) ?? [])

  return {
    name: "CollectAssets",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root, file) => {
            const assets = new Set<string>()

            visit(tree, "element", (node) => {
              const props = node.properties ?? {}
              if (
                ["img", "video", "audio", "source", "iframe"].includes(node.tagName) &&
                typeof props.src === "string" &&
                isLocalAsset(props.src, extensionSet)
              ) {
                assets.add(normalizeAssetPath(props.src))
              }

              if (
                node.tagName === "video" &&
                typeof props.poster === "string" &&
                isLocalAsset(props.poster, extensionSet)
              ) {
                assets.add(normalizeAssetPath(props.poster))
              }

              if (
                node.tagName === "a" &&
                typeof props.href === "string" &&
                isLocalAsset(props.href, extensionSet)
              ) {
                assets.add(normalizeAssetPath(props.href))
              }

              if (typeof props.dataSrc === "string" && isLocalAsset(props.dataSrc, extensionSet)) {
                assets.add(normalizeAssetPath(props.dataSrc))
              }
            })

            file.data.assets = [...assets]
          }
        },
      ]
    },
  }
}

export default CollectAssets

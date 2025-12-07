import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import { Root } from "hast"
import path from "path"

interface Options {
  /**
   * File extensions to collect as assets
   * @default common image/video/audio/document extensions
   */
  extensions?: string[]
}

const defaultOptions: Options = {
  extensions: [
    // Images
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".svg",
    ".webp",
    ".ico",
    ".avif",
    // Videos
    ".mp4",
    ".webm",
    ".ogv",
    ".mov",
    ".mkv",
    ".avi",
    // Audio
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
    ".flac",
    ".aac",
    // Documents
    ".pdf",
    // Fonts
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
  ],
}

/**
 * CollectAssets transformer plugin
 *
 * Collects all asset references (images, videos, audio, etc.) from parsed HTML.
 * These are stored in `file.data.assets` for use by the OnDemandAssets emitter.
 */
export const CollectAssets: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  const extensionSet = new Set(opts.extensions?.map((ext) => ext.toLowerCase()) ?? [])

  return {
    name: "CollectAssets",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root, file) => {
            const assets: Set<string> = new Set()

            visit(tree, "element", (node) => {
              // Collect src attributes from img, video, audio, source, iframe
              if (
                ["img", "video", "audio", "source", "iframe"].includes(node.tagName) &&
                node.properties &&
                typeof node.properties.src === "string"
              ) {
                const src = node.properties.src
                if (isLocalAsset(src, extensionSet)) {
                  assets.add(normalizeAssetPath(src))
                }
              }

              // Collect poster attribute from video
              if (
                node.tagName === "video" &&
                node.properties &&
                typeof node.properties.poster === "string"
              ) {
                const poster = node.properties.poster
                if (isLocalAsset(poster, extensionSet)) {
                  assets.add(normalizeAssetPath(poster))
                }
              }

              // Collect href for download links (like PDFs)
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                const href = node.properties.href
                if (isLocalAsset(href, extensionSet)) {
                  assets.add(normalizeAssetPath(href))
                }
              }

              // Collect data-src for lazy loaded images
              if (node.properties && typeof node.properties.dataSrc === "string") {
                const dataSrc = node.properties.dataSrc
                if (isLocalAsset(dataSrc, extensionSet)) {
                  assets.add(normalizeAssetPath(dataSrc))
                }
              }
            })

            // Store collected assets in file data
            file.data.assets = [...assets]
          }
        },
      ]
    },
  }
}

/**
 * Check if a URL is a local asset (not external) and has a matching extension
 */
function isLocalAsset(url: string, extensions: Set<string>): boolean {
  // Skip external URLs
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return false
  }
  // Skip data URLs
  if (url.startsWith("data:")) {
    return false
  }
  // Check extension
  const ext = path.extname(url).toLowerCase().split("?")[0] // Remove query params
  return extensions.has(ext)
}

/**
 * Normalize asset path by removing leading slashes and query params
 */
function normalizeAssetPath(url: string): string {
  // Remove query params and hash
  let normalized = url.split("?")[0].split("#")[0]
  // Decode URI components
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // Keep original if decode fails
  }
  // Remove leading slash for consistency
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1)
  }
  return normalized
}

// Extend vfile DataMap to include assets
declare module "vfile" {
  interface DataMap {
    assets: string[]
  }
}

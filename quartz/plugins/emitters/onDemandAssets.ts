import { FilePath, joinSegments, slugifyFilePath } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import path from "path"
import fs from "fs"
import { glob } from "../../util/glob"
import { Argv } from "../../util/ctx"
import { QuartzConfig } from "../../cfg"
import { ProcessedContent } from "../vfile"
import { getAllFolderNotes } from "../filters/folderNotes"

/**
 * Slugify a path segment (matching the logic in path.ts sluggify)
 */
function sluggifySegment(s: string): string {
  return s
    .replace(/\s/g, "-")
    .replace(/&/g, "-and-")
    .replace(/%/g, "-percent")
    .replace(/\?/g, "")
    .replace(/#/g, "")
}

interface Options {
  /**
   * Whether to include assets that couldn't be resolved to actual files
   * @default false
   */
  includeUnresolved?: boolean
  /**
   * Additional asset patterns to always include (glob patterns)
   * @default []
   */
  alwaysInclude?: string[]
}

const defaultOptions: Options = {
  includeUnresolved: false,
  alwaysInclude: [],
}

/**
 * Collect all referenced assets from content (including folder notes that were filtered out)
 */
function collectReferencedAssets(content: ProcessedContent[]): Set<string> {
  const referencedAssets = new Set<string>()

  // Collect from regular content
  for (const [_tree, file] of content) {
    const assets = file.data.assets ?? []
    for (const asset of assets) {
      referencedAssets.add(asset)
    }
  }

  // Also collect from folder notes that were filtered out
  const folderNotes = getAllFolderNotes()
  for (const [_path, [_tree, file]] of folderNotes.entries()) {
    const assets = file.data.assets ?? []
    for (const asset of assets) {
      referencedAssets.add(asset)
    }
  }

  return referencedAssets
}

/**
 * Get all available assets in the content directory
 */
async function getAllAssets(argv: Argv, cfg: QuartzConfig): Promise<Map<string, FilePath>> {
  // Glob all non-MD files
  const files = await glob("**", argv.directory, ["**/*.md", ...cfg.configuration.ignorePatterns])

  // Create a map of various path forms -> full path for lookup
  const assetMap = new Map<string, FilePath>()
  for (const fp of files) {
    // Index by original path
    assetMap.set(fp, fp)

    // Index by basename (original form)
    const basename = path.basename(fp)
    if (!assetMap.has(basename)) {
      assetMap.set(basename, fp)
    }

    // Index by slugified basename (for matching HTML src attributes)
    // HTML src is slugified in ofm.ts, so we need to map slugified -> original
    const slugifiedBasename = sluggifySegment(basename)
    if (slugifiedBasename !== basename && !assetMap.has(slugifiedBasename)) {
      assetMap.set(slugifiedBasename, fp)
    }

    // Index by slugified full path
    const slugifiedPath = fp
      .split("/")
      .map((seg) => sluggifySegment(seg))
      .join("/")
    if (slugifiedPath !== fp && !assetMap.has(slugifiedPath)) {
      assetMap.set(slugifiedPath, fp)
    }
  }

  return assetMap
}

/**
 * Resolve an asset reference to an actual file path
 */
function resolveAsset(ref: string, assetMap: Map<string, FilePath>): FilePath | undefined {
  // Try exact match first
  if (assetMap.has(ref)) {
    return assetMap.get(ref)
  }

  // Try basename match (for Obsidian shortest path)
  const basename = path.basename(ref)
  if (assetMap.has(basename)) {
    return assetMap.get(basename)
  }

  // Try with decoded URI
  try {
    const decoded = decodeURIComponent(ref)
    if (assetMap.has(decoded)) {
      return assetMap.get(decoded)
    }
    const decodedBasename = path.basename(decoded)
    if (assetMap.has(decodedBasename)) {
      return assetMap.get(decodedBasename)
    }
  } catch {
    // Ignore decode errors
  }

  return undefined
}

/**
 * Copy a file from content directory to output
 */
async function copyFile(argv: Argv, fp: FilePath): Promise<FilePath> {
  const src = joinSegments(argv.directory, fp) as FilePath
  const name = slugifyFilePath(fp)
  const dest = joinSegments(argv.output, name) as FilePath

  // Ensure directory exists
  const dir = path.dirname(dest) as FilePath
  await fs.promises.mkdir(dir, { recursive: true })

  await fs.promises.copyFile(src, dest)
  return dest
}

/**
 * OnDemandAssets emitter plugin
 *
 * Only copies assets that are actually referenced in the content.
 * This significantly reduces build output size by not including unused assets.
 *
 * Requires the CollectAssets transformer to be used first.
 */
export const OnDemandAssets: QuartzEmitterPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "OnDemandAssets",
    async *emit({ argv, cfg }, content) {
      // Get all available assets
      const assetMap = await getAllAssets(argv, cfg)

      // Collect referenced assets from content
      const referencedAssets = collectReferencedAssets(content)

      // Track which assets we've already copied to avoid duplicates
      const copiedAssets = new Set<FilePath>()

      // Process referenced assets
      for (const ref of referencedAssets) {
        const resolved = resolveAsset(ref, assetMap)
        if (resolved && !copiedAssets.has(resolved)) {
          copiedAssets.add(resolved)
          yield copyFile(argv, resolved)
        }
      }

      // Process always-include patterns
      if (opts.alwaysInclude && opts.alwaysInclude.length > 0) {
        for (const pattern of opts.alwaysInclude) {
          const files = await glob(pattern, argv.directory, cfg.configuration.ignorePatterns)
          for (const fp of files) {
            if (!copiedAssets.has(fp)) {
              copiedAssets.add(fp)
              yield copyFile(argv, fp)
            }
          }
        }
      }

      // Log statistics
      const totalAssets = assetMap.size
      const copiedCount = copiedAssets.size
      const savedCount = totalAssets - copiedCount
      if (savedCount > 0) {
        console.log(
          `\n📦 OnDemandAssets: Copied ${copiedCount}/${totalAssets} assets (saved ${savedCount} unused files)`,
        )
      }
    },
    async *partialEmit(ctx, content, _resources, changeEvents) {
      const referencedAssets = collectReferencedAssets(content)

      for (const changeEvent of changeEvents) {
        const ext = path.extname(changeEvent.path)
        if (ext === ".md") continue

        if (changeEvent.type === "add" || changeEvent.type === "change") {
          // Only copy if the asset is referenced
          const isReferenced =
            referencedAssets.has(changeEvent.path) ||
            referencedAssets.has(path.basename(changeEvent.path))

          if (isReferenced) {
            yield copyFile(ctx.argv, changeEvent.path)
          }
        } else if (changeEvent.type === "delete") {
          const name = slugifyFilePath(changeEvent.path)
          const dest = joinSegments(ctx.argv.output, name) as FilePath
          try {
            await fs.promises.unlink(dest)
          } catch {
            // Ignore if file doesn't exist
          }
        }
      }
    },
  }
}

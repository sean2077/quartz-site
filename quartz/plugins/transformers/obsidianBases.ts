import { QuartzTransformerPlugin } from "../types"
import { Root, Code } from "mdast"
import { visit } from "unist-util-visit"
import yaml from "js-yaml"
import { BaseConfig, BaseBlock, ObsidianBasesOptions, defaultOptions } from "../../util/bases/types"

/**
 * ObsidianBases Transformer Plugin
 *
 * Parses ```base code blocks and stores configuration in file.data.baseBlocks
 * for later processing by the BasesRenderer emitter.
 *
 * This two-phase approach is needed because:
 * 1. Transformers run during markdown parsing (don't have access to all files' frontmatter)
 * 2. Emitters run after all files are parsed (have access to allFiles with full data)
 */
export const ObsidianBases: QuartzTransformerPlugin<Partial<ObsidianBasesOptions>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "ObsidianBases",

    markdownPlugins() {
      return [
        () => {
          return (tree: Root, file) => {
            let blockIndex = 0

            visit(tree, "code", (node: Code, index, parent) => {
              if (node.lang !== "base") return
              if (index === undefined || !parent) return

              try {
                // Parse YAML configuration
                const config = yaml.load(node.value) as BaseConfig

                // Validate config
                if (!config || typeof config !== "object") {
                  console.warn(`[ObsidianBases] Invalid base config in ${file.data.slug}`)
                  return
                }

                // Generate unique placeholder ID
                const placeholderId = `base-${file.data.slug}-${blockIndex++}`

                // Initialize baseBlocks array if not exists
                if (!file.data.baseBlocks) {
                  file.data.baseBlocks = []
                }

                // Store config for later processing by emitter
                const baseBlock: BaseBlock = {
                  id: placeholderId,
                  config: {
                    ...config,
                    // Apply default view if none specified
                    views: config.views ?? [
                      {
                        type: opts.defaultView,
                        name: opts.defaultView.charAt(0).toUpperCase() + opts.defaultView.slice(1),
                      },
                    ],
                  },
                }
                file.data.baseBlocks.push(baseBlock)

                // Mark file as having base views
                file.data.hasBaseView = true

                // Check if any view is a map type
                if (config.views?.some((v) => v.type === "map")) {
                  file.data.hasMapView = true
                }

                // Replace code block with placeholder div
                // The BasesRenderer emitter will replace this with actual content
                ;(parent.children[index] as unknown) = {
                  type: "html",
                  value: `<div class="base-placeholder" data-base-id="${placeholderId}"></div>`,
                }

                console.log(
                  `[ObsidianBases] Parsed base block in ${file.data.slug}: ${placeholderId}`,
                )
              } catch (e) {
                console.error(`[ObsidianBases] Error parsing base block in ${file.data.slug}:`, e)
                // Replace with error message
                ;(parent.children[index] as unknown) = {
                  type: "html",
                  value: `<div class="base-error">Error parsing base configuration: ${e instanceof Error ? e.message : "Unknown error"}</div>`,
                }
              }
            })
          }
        },
      ]
    },
  }
}

// Extend vfile DataMap for type safety
declare module "vfile" {
  interface DataMap {
    baseBlocks: BaseBlock[]
    hasBaseView: boolean
    hasMapView: boolean
  }
}

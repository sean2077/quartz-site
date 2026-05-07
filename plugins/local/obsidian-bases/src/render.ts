import type { Root, Element } from "hast"
import { visit } from "unist-util-visit"
import type { FullSlug, QuartzPluginData } from "@quartz-community/types"
import type { BaseBlock, ObsidianBasesOptions } from "./types.ts"
import { defaultOptions } from "./types.ts"
import { executeQuery } from "./query.ts"
import { renderBaseViews } from "./views.ts"
import { fromHtml } from "hast-util-from-html"

/**
 * Render all base placeholders in the HTML tree
 * This should be called from renderPage after transclusion rendering
 */
export function renderBasePlaceholders(
  root: Root,
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
  opts: Partial<ObsidianBasesOptions> = {},
): void {
  const options = { ...defaultOptions, ...opts }
  const baseBlocks = (fileData.baseBlocks as BaseBlock[]) ?? []

  if (baseBlocks.length === 0) return

  // Create a map for quick lookup
  const blockMap = new Map<string, BaseBlock>()
  for (const block of baseBlocks) {
    blockMap.set(block.id, block)
  }

  // Find and replace all base placeholders
  visit(root, "element", (node: Element, index, parent) => {
    if (
      node.tagName !== "div" ||
      !node.properties?.className ||
      !(node.properties.className as string[]).includes("base-placeholder")
    ) {
      return
    }

    const baseId = node.properties["dataBaseId"] as string
    if (!baseId) return

    const block = blockMap.get(baseId)
    if (!block) {
      console.warn(`[ObsidianBases] Base block not found: ${baseId}`)
      return
    }

    try {
      // Execute query (pass fileData as currentFile for this.file references)
      const filteredFiles = executeQuery(allFiles, block.config, options.maxResults, fileData)

      // Render views
      const currentSlug = (fileData.slug ?? "") as FullSlug
      const rendered = renderBaseViews(block.config, filteredFiles, currentSlug)

      // Parse HTML string to HAST
      const parsedHtml = fromHtml(rendered.html, { fragment: true })

      // Replace placeholder with rendered content
      if (parent && typeof index === "number") {
        // Replace the node's children with the parsed content
        const newNode: Element = {
          type: "element",
          tagName: "div",
          properties: {
            className: ["base-rendered"],
            dataBaseId: baseId,
          },
          children: parsedHtml.children as Element["children"],
        }
        parent.children[index] = newNode
      }
    } catch (e) {
      console.error(`[ObsidianBases] Error rendering base ${baseId}:`, e)

      // Replace with error message
      if (parent && typeof index === "number") {
        const errorNode: Element = {
          type: "element",
          tagName: "div",
          properties: {
            className: ["base-error"],
          },
          children: [
            {
              type: "text",
              value: `Error rendering base: ${e instanceof Error ? e.message : "Unknown error"}`,
            },
          ],
        }
        parent.children[index] = errorNode
      }
    }
  })
}

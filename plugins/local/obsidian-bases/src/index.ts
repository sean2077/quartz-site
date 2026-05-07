import { readFileSync } from "node:fs"
import { transformSync } from "esbuild"
import type { Code, Root as MdRoot } from "mdast"
import { visit } from "unist-util-visit"
import { parse as parseYaml } from "yaml"
import type {
  QuartzComponent,
  QuartzPageTypePluginInstance,
  QuartzTransformerPluginInstance,
} from "@quartz-community/types"
import type { BaseBlock, BaseConfig, ObsidianBasesOptions } from "./types.ts"
import { defaultOptions } from "./types.ts"
import { renderBasePlaceholders } from "./render.ts"

export * from "./types.ts"
export * from "./query.ts"
export * from "./views.ts"
export * from "./render.ts"

const css = `
.base-container,
.base-rendered {
  margin: 1rem 0;
}
.base-error {
  padding: 1rem;
  background: rgba(255, 0, 0, 0.05);
  border-left: 3px solid rgba(255, 0, 0, 0.5);
  color: var(--dark);
  font-size: 0.9rem;
}
.base-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--gray);
  font-style: italic;
}
.base-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--lightgray);
  padding-bottom: 0.5rem;
}
.base-tab {
  padding: 0.3rem 0.8rem;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--gray);
  font-size: 0.85rem;
  border-radius: 4px;
}
.base-tab:hover,
.base-tab.active {
  color: var(--secondary);
  background: var(--highlight);
}
.base-view-container {
  display: none;
}
.base-view-container.active {
  display: block;
}
.base-view.base-table,
.base-view.base-paginated-table {
  overflow-x: auto;
}
.base-view table {
  margin: 0;
  padding: 0;
  border-collapse: collapse;
  width: 100%;
}
.base-view th {
  text-align: left;
  padding: 0.4rem 0.7rem;
  border-bottom: 2px solid var(--gray);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.base-view th[data-sort="asc"]::after {
  content: " ↑";
  color: var(--secondary);
}
.base-view th[data-sort="desc"]::after {
  content: " ↓";
  color: var(--secondary);
}
.base-view td {
  padding: 0.2rem 0.7rem;
  min-width: 75px;
}
.base-view tr {
  border-bottom: 1px solid var(--lightgray);
}
.base-view tbody tr:hover {
  background: var(--highlight);
}
.base-view.base-paginated-table {
  overflow-x: visible;
}
.bpt-toolbar,
.bpt-pagination,
.bpt-active-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.bpt-toolbar {
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.bpt-search,
.bpt-page-size-select {
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  background: var(--light);
  color: var(--dark);
}
.bpt-search {
  padding: 0.35rem 0.6rem;
  min-width: 180px;
}
.bpt-prev,
.bpt-next,
.bpt-filter-chip {
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  background: transparent;
  color: var(--dark);
  cursor: pointer;
}
.bpt-filter-chip {
  background: var(--highlight);
  color: var(--secondary);
}
.bpt-table-wrapper {
  overflow-x: auto;
}
.base-paginated-table[data-sticky-header="true"] .bpt-table-wrapper {
  max-height: 70vh;
  overflow-y: auto;
}
.base-paginated-table[data-sticky-header="true"] thead {
  position: sticky;
  top: 0;
  background: var(--light);
  z-index: 1;
}
.base-view.base-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}
.base-card {
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--lightgray);
}
.base-card:hover {
  border-left-color: var(--secondary);
}
.card-property {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
}
.property-name,
.base-null {
  color: var(--gray);
}
.base-view.base-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.base-view.base-list li {
  padding: 0.4rem 0;
  display: flex;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
}
.base-view.base-map {
  min-height: 350px;
  border: 1px solid var(--lightgray);
  border-radius: 5px;
  overflow: hidden;
}
.base-map-container {
  width: 100%;
  height: 350px;
}
.base-rendered .tag,
.base-container .tag {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  margin: 0 0.1rem;
  background: var(--highlight);
  border-radius: 3px;
  font-size: 0.8rem;
  color: var(--secondary);
  text-decoration: none;
}
@media (max-width: 768px) {
  .base-view.base-cards {
    grid-template-columns: 1fr;
  }
  .bpt-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .bpt-search {
    min-width: unset;
    width: 100%;
  }
}
`

function loadClientScript(): string {
  const source = readFileSync(new URL("./bases.inline.ts", import.meta.url), "utf8")
  return transformSync(source, {
    loader: "ts",
    minify: true,
    format: "iife",
  }).code
}

function parseBaseBlocks(opts: ObsidianBasesOptions) {
  return () => {
    return (tree: MdRoot, file: { data: Record<string, unknown> }) => {
      let blockIndex = 0

      visit(tree, "code", (node: Code, index, parent) => {
        if (node.lang !== "base" || index === undefined || !parent) return

        try {
          const config = parseYaml(node.value) as BaseConfig
          if (!config || typeof config !== "object") {
            console.warn(`[ObsidianBases] Invalid base config in ${String(file.data.slug)}`)
            return
          }

          const placeholderId = `base-${String(file.data.slug)}-${blockIndex++}`
          const baseBlock: BaseBlock = {
            id: placeholderId,
            config: {
              ...config,
              views: config.views ?? [
                {
                  type: opts.defaultView,
                  name: opts.defaultView.charAt(0).toUpperCase() + opts.defaultView.slice(1),
                },
              ],
            },
          }

          const blocks = (file.data.baseBlocks as BaseBlock[] | undefined) ?? []
          blocks.push(baseBlock)
          file.data.baseBlocks = blocks
          file.data.hasBaseView = true
          file.data.hasMapView = config.views?.some((view) => view.type === "map") ?? false

          parent.children[index] = {
            type: "html",
            value: `<div class="base-placeholder" data-base-id="${placeholderId}"></div>`,
          } as never
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error"
          parent.children[index] = {
            type: "html",
            value: `<div class="base-error">Error parsing base configuration: ${message}</div>`,
          } as never
        }
      })
    }
  }
}

const EmptyBody = () => {
  const Empty: QuartzComponent = () => null
  return Empty
}

export default function ObsidianBases(
  userOpts?: Partial<ObsidianBasesOptions>,
): QuartzTransformerPluginInstance & QuartzPageTypePluginInstance {
  const opts = { ...defaultOptions, ...userOpts }

  return {
    name: "ObsidianBases",
    markdownPlugins() {
      return [parseBaseBlocks(opts)]
    },
    externalResources() {
      return {
        css: [{ content: css, inline: true }],
        js: [
          {
            loadTime: "afterDOMReady",
            contentType: "inline",
            script: loadClientScript(),
          },
        ],
      }
    },
    priority: -100,
    match: () => false,
    layout: "content",
    body: EmptyBody,
    treeTransforms() {
      return [
        (root, _slug, componentData) =>
          renderBasePlaceholders(root, componentData.fileData, componentData.allFiles, opts),
      ]
    },
  }
}

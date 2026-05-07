import type { FullSlug, QuartzPluginData } from "@quartz-community/types"
import type {
  ViewConfig,
  PropertyConfig,
  BaseConfig,
  RenderedView,
  PropertyValue,
} from "./types.ts"
import { getPropertyValue } from "./query.ts"
import { resolveRelative } from "@quartz-community/utils"

/**
 * Render all views for a base configuration
 */
export function renderBaseViews(
  config: BaseConfig,
  files: QuartzPluginData[],
  currentSlug: FullSlug,
): RenderedView {
  const views = config.views ?? [{ type: "table", name: "Table" }]
  const properties = config.properties ?? {}
  let hasMap = false

  // Single view - no tabs needed
  if (views.length === 1) {
    const viewHtml = renderSingleView(views[0], files, properties, currentSlug)
    if (views[0].type === "map") hasMap = true

    return {
      html: `<div class="base-container">${viewHtml}</div>`,
      hasMap,
    }
  }

  // Multiple views - create tabbed interface
  const tabsHtml = views
    .map(
      (view, i) =>
        `<button class="base-tab${i === 0 ? " active" : ""}" data-view-index="${i}">${escapeHtml(view.name)}</button>`,
    )
    .join("")

  const viewsHtml = views
    .map((view, i) => {
      if (view.type === "map") hasMap = true
      const viewHtml = renderSingleView(view, files, properties, currentSlug)
      return `<div class="base-view-container${i === 0 ? " active" : ""}" data-view-index="${i}">${viewHtml}</div>`
    })
    .join("")

  return {
    html: `
      <div class="base-container">
        <div class="base-tabs">${tabsHtml}</div>
        <div class="base-views">${viewsHtml}</div>
      </div>
    `,
    hasMap,
  }
}

/**
 * Render a single view
 */
function renderSingleView(
  view: ViewConfig,
  files: QuartzPluginData[],
  properties: Record<string, PropertyConfig>,
  currentSlug: FullSlug,
): string {
  switch (view.type) {
    case "table":
      return renderTableView(view, files, properties, currentSlug)
    case "card":
      return renderCardView(view, files, properties, currentSlug)
    case "list":
      return renderListView(view, files, properties, currentSlug)
    case "map":
      return renderMapView(view, files, properties, currentSlug)
    case "paginated-table":
      return renderPaginatedTableView(view, files, properties, currentSlug)
    default:
      return `<div class="base-error">Unknown view type: ${(view as ViewConfig).type}</div>`
  }
}

/**
 * Render table view
 */
function renderTableView(
  view: ViewConfig,
  files: QuartzPluginData[],
  properties: Record<string, PropertyConfig>,
  currentSlug: FullSlug,
): string {
  // Default columns if not specified
  const order = view.order ?? ["file.name"]

  if (files.length === 0) {
    return `<div class="base-view base-table base-empty">No matching files found</div>`
  }

  const headerCells = order
    .map((prop) => {
      const displayName = properties[prop]?.displayName ?? formatPropertyName(prop)
      return `<th data-property="${escapeHtml(prop)}">${escapeHtml(displayName)}</th>`
    })
    .join("")

  const rows = files
    .map((file) => {
      const cells = order
        .map((prop) => {
          const value = getPropertyValue(file, prop)
          const displayValue = formatValue(value, file, prop, currentSlug)
          return `<td>${displayValue}</td>`
        })
        .join("")
      return `<tr>${cells}</tr>`
    })
    .join("")

  return `
    <div class="base-view base-table">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

/**
 * Render paginated table view
 * All rows are rendered server-side; client-side JS handles pagination, search, sort, and quick-filter.
 */
function renderPaginatedTableView(
  view: ViewConfig,
  files: QuartzPluginData[],
  properties: Record<string, PropertyConfig>,
  currentSlug: FullSlug,
): string {
  const order = view.order ?? ["file.name"]
  const pageSize = view.pageSize ?? 25
  const showSearchBox = view.showSearchBox !== false
  const stickyHeader = view.stickyHeader !== false
  const paginationPosition = view.paginationPosition ?? "top"

  if (files.length === 0) {
    return `<div class="base-view base-paginated-table base-empty">No matching files found</div>`
  }

  // Build header cells
  const headerCells = order
    .map((prop) => {
      const displayName = properties[prop]?.displayName ?? formatPropertyName(prop)
      return `<th data-property="${escapeHtml(prop)}">${escapeHtml(displayName)}</th>`
    })
    .join("")

  // Build rows with data attributes for client-side filtering
  const rows = files
    .map((file) => {
      const searchParts: string[] = []
      const cells = order
        .map((prop) => {
          const value = getPropertyValue(file, prop)
          const displayValue = formatValue(value, file, prop, currentSlug)
          // Extract raw text for search and quick-filter
          const rawText = extractRawText(value, file, prop)
          searchParts.push(rawText.toLowerCase())
          return `<td data-col="${escapeHtml(prop)}" data-value="${escapeHtml(rawText)}">${displayValue}</td>`
        })
        .join("")
      const searchable = escapeHtml(searchParts.join(" "))
      return `<tr data-searchable="${searchable}">${cells}</tr>`
    })
    .join("")

  // Build toolbar
  const searchHtml = showSearchBox
    ? `<input class="bpt-search" type="text" placeholder="Search..." aria-label="Search table" />`
    : ""

  const defaultSizes = [10, 25, 50, 100]
  const sizes = defaultSizes.includes(pageSize)
    ? defaultSizes
    : [...defaultSizes, pageSize].sort((a, b) => a - b)
  const pageSizeOptions = sizes
    .map(
      (size) => `<option value="${size}"${size === pageSize ? " selected" : ""}>${size}</option>`,
    )
    .join("")

  const paginationHtml = `
    <div class="bpt-pagination">
      <span class="bpt-page-info"></span>
      <button class="bpt-prev" disabled aria-label="Previous page">&larr;</button>
      <button class="bpt-next" aria-label="Next page">&rarr;</button>
      <select class="bpt-page-size-select" aria-label="Items per page">${pageSizeOptions}</select>
    </div>
  `

  const toolbarHtml = `<div class="bpt-toolbar">${searchHtml}${paginationHtml}</div>`

  const tableHtml = `
    <div class="bpt-table-wrapper">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `

  return `
    <div class="base-view base-paginated-table"
         data-page-size="${pageSize}"
         data-sticky-header="${stickyHeader}"
         data-pagination-position="${paginationPosition}">
      ${paginationPosition === "top" ? toolbarHtml : ""}
      <div class="bpt-active-filters"></div>
      ${tableHtml}
      ${paginationPosition === "bottom" ? toolbarHtml : ""}
    </div>
  `
}

/**
 * Extract raw text from a property value for search/filter data attributes.
 */
function extractRawText(value: PropertyValue, file: QuartzPluginData, prop: string): string {
  if (prop === "file.name") {
    return file.frontmatter?.title ?? file.slug?.split("/").pop() ?? "Untitled"
  }
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}

/**
 * Render card view
 */
function renderCardView(
  view: ViewConfig,
  files: QuartzPluginData[],
  properties: Record<string, PropertyConfig>,
  currentSlug: FullSlug,
): string {
  const order = view.order ?? ["file.name"]

  if (files.length === 0) {
    return `<div class="base-view base-cards base-empty">No matching files found</div>`
  }

  const cards = files
    .map((file) => {
      const title = file.frontmatter?.title ?? file.slug?.split("/").pop() ?? "Untitled"
      const href = resolveRelative(currentSlug, file.slug as FullSlug)

      const propsHtml = order
        .filter((prop) => prop !== "file.name") // Skip title property in card body
        .map((prop) => {
          const displayName = properties[prop]?.displayName ?? formatPropertyName(prop)
          const value = getPropertyValue(file, prop)
          const displayValue = formatValue(value, file, prop, currentSlug)
          return `
          <div class="card-property">
            <span class="property-name">${escapeHtml(displayName)}</span>
            <span class="property-value">${displayValue}</span>
          </div>
        `
        })
        .join("")

      return `
        <div class="base-card">
          <h4><a href="${escapeHtml(href)}" class="internal">${escapeHtml(title)}</a></h4>
          <div class="card-properties">${propsHtml}</div>
        </div>
      `
    })
    .join("")

  return `<div class="base-view base-cards">${cards}</div>`
}

/**
 * Render list view
 */
function renderListView(
  view: ViewConfig,
  files: QuartzPluginData[],
  _properties: Record<string, PropertyConfig>,
  currentSlug: FullSlug,
): string {
  const order = view.order ?? ["file.name"]

  if (files.length === 0) {
    return `<div class="base-view base-list base-empty">No matching files found</div>`
  }

  const items = files
    .map((file) => {
      const title = file.frontmatter?.title ?? file.slug?.split("/").pop() ?? "Untitled"
      const href = resolveRelative(currentSlug, file.slug as FullSlug)

      const extraProps = order
        .filter((prop) => prop !== "file.name")
        .map((prop) => {
          const value = getPropertyValue(file, prop)
          const displayValue = formatValue(value, file, prop, currentSlug)
          return `<span class="list-property">${displayValue}</span>`
        })
        .join("")

      return `
        <li>
          <a href="${escapeHtml(href)}" class="internal">${escapeHtml(title)}</a>
          ${extraProps}
        </li>
      `
    })
    .join("")

  return `<div class="base-view base-list"><ul>${items}</ul></div>`
}

/**
 * Render map view
 */
function renderMapView(
  view: ViewConfig,
  files: QuartzPluginData[],
  _properties: Record<string, PropertyConfig>,
  currentSlug: FullSlug,
): string {
  const latProp = view.lat ?? "lat"
  const longProp = view.long ?? "long"

  // Collect markers from files with valid coordinates
  const markers = files
    .map((file) => {
      const lat = getPropertyValue(file, latProp)
      const lng = getPropertyValue(file, longProp)

      if (typeof lat !== "number" || typeof lng !== "number") return null
      if (isNaN(lat) || isNaN(lng)) return null

      const title = file.frontmatter?.title ?? file.slug?.split("/").pop() ?? "Untitled"
      const href = resolveRelative(currentSlug, file.slug as FullSlug)

      return { lat, lng, title, href }
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)

  if (markers.length === 0) {
    return `<div class="base-view base-map base-empty">No files with valid coordinates found</div>`
  }

  // Encode markers as data attribute for client-side initialization
  const markersJson = JSON.stringify(markers)

  return `
    <div class="base-view base-map" data-markers='${escapeHtml(markersJson)}'>
      <div class="base-map-container"></div>
    </div>
  `
}

/**
 * Format a property value for display
 */
function formatValue(
  value: PropertyValue,
  file: QuartzPluginData,
  prop: string,
  currentSlug: FullSlug,
): string {
  // Handle file.name specially - make it a link
  if (prop === "file.name") {
    const title = file.frontmatter?.title ?? file.slug?.split("/").pop() ?? "Untitled"
    const href = resolveRelative(currentSlug, file.slug as FullSlug)
    return `<a href="${escapeHtml(href)}" class="internal">${escapeHtml(title)}</a>`
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return `<span class="base-null">-</span>`
  }

  // Handle dates
  if (value instanceof Date) {
    // Format: YYYY-MM-DD HH:mm in local timezone
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    const hours = String(value.getHours()).padStart(2, "0")
    const minutes = String(value.getMinutes()).padStart(2, "0")
    const dateStr = `${year}-${month}-${day} ${hours}:${minutes}`
    return `<time datetime="${value.toISOString()}">${dateStr}</time>`
  }

  // Handle arrays (like tags)
  if (Array.isArray(value)) {
    if (value.length === 0) return `<span class="base-null">-</span>`

    // Check if this is the tags property
    if (prop === "tags" || prop === "note.tags") {
      return value
        .map((tag) => {
          const tagSlug = `tags/${String(tag).toLowerCase().replace(/\s+/g, "-")}`
          const href = resolveRelative(currentSlug, tagSlug as FullSlug)
          return `<a href="${escapeHtml(href)}" class="tag">#${escapeHtml(String(tag))}</a>`
        })
        .join(" ")
    }

    return escapeHtml(value.join(", "))
  }

  // Handle booleans
  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }

  // Handle numbers
  if (typeof value === "number") {
    return String(value)
  }

  // Default: escape string
  return escapeHtml(String(value))
}

/**
 * Format a property name for display
 */
function formatPropertyName(prop: string): string {
  // Remove prefixes
  let name = prop
  if (name.startsWith("file.")) name = name.slice(5)
  if (name.startsWith("note.")) name = name.slice(5)

  // Convert camelCase to Title Case
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

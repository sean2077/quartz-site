import { QuartzPluginData } from "../../plugins/vfile"

/**
 * Obsidian Bases configuration types
 * Based on https://help.obsidian.md/bases/syntax
 */

// Filter expression can be a string or nested logical structure
export type FilterExpression =
  | string
  | { and: FilterExpression[] }
  | { or: FilterExpression[] }
  | { not: FilterExpression }

// Property configuration for display names and formatting
export interface PropertyConfig {
  displayName?: string
  width?: string | number
  format?: string
}

// Sort configuration
export interface SortConfig {
  property: string
  direction: "asc" | "desc" | "ASC" | "DESC"
}

// View configuration
export interface ViewConfig {
  type: "table" | "card" | "list" | "map"
  name: string
  filters?: FilterExpression
  order?: string[]
  sort?: SortConfig[]
  group_by?: string
  limit?: number
  // Map-specific properties
  lat?: string
  long?: string
  title?: string
}

// Main Base configuration (YAML schema)
export interface BaseConfig {
  filters?: FilterExpression
  formulas?: Record<string, string>
  properties?: Record<string, PropertyConfig>
  views?: ViewConfig[]
}

// Stored base block information
export interface BaseBlock {
  id: string
  config: BaseConfig
}

// Query result
export interface QueryResult {
  files: QuartzPluginData[]
  computedProperties: Map<string, Record<string, unknown>>
}

// Filter function type (currentFile is the file containing the base block)
export type FilterFn = (
  file: QuartzPluginData,
  allFiles: QuartzPluginData[],
  currentFile?: QuartzPluginData,
) => boolean

// Property value types
export type PropertyValue = string | number | boolean | Date | string[] | null | undefined

// Rendered view output
export interface RenderedView {
  html: string
  hasMap: boolean
}

// Plugin options
export interface ObsidianBasesOptions {
  /** Enable map view (loads Leaflet). Default: true */
  enableMap: boolean
  /** Default view type when not specified. Default: 'table' */
  defaultView: "table" | "card" | "list"
  /** Maximum number of results. Default: 100 */
  maxResults: number
  /** Enable client-side table sorting. Default: true */
  enableClientSort: boolean
}

export const defaultOptions: ObsidianBasesOptions = {
  enableMap: true,
  defaultView: "table",
  maxResults: 100,
  enableClientSort: true,
}

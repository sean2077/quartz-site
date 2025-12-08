import { QuartzPluginData } from "../../plugins/vfile"
import { FilterExpression, FilterFn, BaseConfig, SortConfig, PropertyValue } from "./types"

/**
 * Parse a filter expression and return a filter function
 */
export function parseFilter(expression: FilterExpression): FilterFn {
  // Handle nested logical structures
  if (typeof expression === "object") {
    if ("and" in expression) {
      const subFilters = expression.and.map(parseFilter)
      return (file, allFiles) => subFilters.every((fn) => fn(file, allFiles))
    }
    if ("or" in expression) {
      const subFilters = expression.or.map(parseFilter)
      return (file, allFiles) => subFilters.some((fn) => fn(file, allFiles))
    }
    if ("not" in expression) {
      const subFilter = parseFilter(expression.not)
      return (file, allFiles) => !subFilter(file, allFiles)
    }
  }

  // Handle string filter expressions
  if (typeof expression === "string") {
    return parseFilterString(expression)
  }

  // Default: accept all
  return () => true
}

/**
 * Parse a string filter expression like "file.hasTag('book')" or "status == 'done'"
 */
function parseFilterString(expr: string): FilterFn {
  const trimmed = expr.trim()

  // file.hasTag("tag")
  const hasTagMatch = trimmed.match(/^file\.hasTag\s*\(\s*["']([^"']+)["']\s*\)$/)
  if (hasTagMatch) {
    const tag = hasTagMatch[1]
    return (file) => {
      const tags = file.frontmatter?.tags ?? []
      return tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    }
  }

  // file.inFolder("path")
  const inFolderMatch = trimmed.match(/^file\.inFolder\s*\(\s*["']([^"']+)["']\s*\)$/)
  if (inFolderMatch) {
    const folder = inFolderMatch[1]
    return (file) => {
      const slug = file.slug ?? ""
      return slug.startsWith(folder) || slug.includes(`/${folder}/`)
    }
  }

  // file.hasLink("note")
  const hasLinkMatch = trimmed.match(/^file\.hasLink\s*\(\s*["']([^"']+)["']\s*\)$/)
  if (hasLinkMatch) {
    const linkTarget = hasLinkMatch[1].toLowerCase()
    return (file) => {
      const links = file.links ?? []
      return links.some((link) => {
        // link is SimpleSlug, convert to string for comparison
        return String(link).toLowerCase().includes(linkTarget)
      })
    }
  }

  // Property comparisons: property == value, property != value, etc.
  const comparisonMatch = trimmed.match(/^([\w.]+)\s*(==|!=|>=|<=|>|<)\s*["']?([^"']+)["']?$/)
  if (comparisonMatch) {
    const [, propPath, operator, valueStr] = comparisonMatch
    return (file) => {
      const propValue = getPropertyValue(file, propPath)
      const compareValue = parseValue(valueStr)
      return compareValues(propValue, operator, compareValue)
    }
  }

  // Simple property check (truthy)
  if (/^[\w.]+$/.test(trimmed)) {
    return (file) => {
      const value = getPropertyValue(file, trimmed)
      return Boolean(value)
    }
  }

  console.warn(`[ObsidianBases] Unknown filter expression: ${expr}`)
  return () => true
}

/**
 * Get a property value from a file
 * Supports: file.name, file.path, file.ctime, file.mtime, file.size
 * And frontmatter properties: property or note.property
 */
export function getPropertyValue(file: QuartzPluginData, propPath: string): PropertyValue {
  const parts = propPath.split(".")

  // File properties
  if (parts[0] === "file") {
    const fileProp = parts[1]
    switch (fileProp) {
      case "name":
        return file.frontmatter?.title ?? file.slug?.split("/").pop() ?? ""
      case "path":
        return file.filePath ?? ""
      case "slug":
        return file.slug ?? ""
      case "ctime":
      case "created":
        return file.dates?.created ?? null
      case "mtime":
      case "modified":
        return file.dates?.modified ?? null
      case "size":
        return null // Not available in QuartzPluginData
      case "ext":
        return "md"
      case "folder":
        const slug = file.slug ?? ""
        const lastSlash = slug.lastIndexOf("/")
        return lastSlash > 0 ? slug.substring(0, lastSlash) : ""
      default:
        return null
    }
  }

  // Frontmatter properties: note.property or just property
  const propName = parts[0] === "note" ? parts.slice(1).join(".") : propPath
  const frontmatter = file.frontmatter as Record<string, unknown> | undefined

  if (!frontmatter) return null

  // Handle nested properties
  const propParts = propName.split(".")
  let value: unknown = frontmatter

  for (const part of propParts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part]
    } else {
      return null
    }
  }

  // Convert date strings to Date objects for proper sorting
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date
    }
  }

  return value as PropertyValue
}

/**
 * Parse a string value to its appropriate type
 */
function parseValue(str: string): PropertyValue {
  const trimmed = str.trim()

  // Boolean
  if (trimmed === "true") return true
  if (trimmed === "false") return false

  // Number
  const num = Number(trimmed)
  if (!isNaN(num)) return num

  // String
  return trimmed
}

/**
 * Compare two values using the specified operator
 */
function compareValues(a: PropertyValue, operator: string, b: PropertyValue): boolean {
  // Handle null/undefined
  if (a === null || a === undefined) {
    if (operator === "==" || operator === "===") return b === null || b === undefined
    if (operator === "!=" || operator === "!==") return b !== null && b !== undefined
    return false
  }

  // Convert to comparable types
  const aStr = String(a).toLowerCase()
  const bStr = String(b).toLowerCase()

  switch (operator) {
    case "==":
    case "===":
      return aStr === bStr
    case "!=":
    case "!==":
      return aStr !== bStr
    case ">":
      return typeof a === "number" && typeof b === "number" ? a > b : aStr > bStr
    case "<":
      return typeof a === "number" && typeof b === "number" ? a < b : aStr < bStr
    case ">=":
      return typeof a === "number" && typeof b === "number" ? a >= b : aStr >= bStr
    case "<=":
      return typeof a === "number" && typeof b === "number" ? a <= b : aStr <= bStr
    default:
      return false
  }
}

/**
 * Sort files by specified configuration
 */
export function sortFiles(files: QuartzPluginData[], sortConfig: SortConfig[]): QuartzPluginData[] {
  return [...files].sort((a, b) => {
    for (const { property, direction } of sortConfig) {
      const aVal = getPropertyValue(a, property)
      const bVal = getPropertyValue(b, property)
      const dir = direction.toLowerCase() === "desc" ? -1 : 1

      if (aVal === bVal) continue

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return dir
      if (bVal === null || bVal === undefined) return -dir

      // Compare dates
      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * dir
      }

      // Compare numbers
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * dir
      }

      // Compare strings
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (aStr < bStr) return -dir
      if (aStr > bStr) return dir
    }
    return 0
  })
}

/**
 * Execute a query against all files
 */
export function executeQuery(
  allFiles: QuartzPluginData[],
  config: BaseConfig,
  maxResults: number = 100,
): QuartzPluginData[] {
  let files = [...allFiles]

  // Apply global filters (top-level)
  if (config.filters) {
    const filterFn = parseFilter(config.filters)
    files = files.filter((f) => filterFn(f, allFiles))
  }

  // Apply first view's config
  const firstView = config.views?.[0]

  // Apply view-level filters (Obsidian puts filters inside views)
  if (firstView?.filters) {
    const viewFilterFn = parseFilter(firstView.filters)
    files = files.filter((f) => viewFilterFn(f, allFiles))
  }

  // Apply sort
  if (firstView?.sort) {
    files = sortFiles(files, firstView.sort)
  } else {
    // Default sort: by title
    files = sortFiles(files, [{ property: "file.name", direction: "asc" }])
  }

  // Apply limit
  const limit = firstView?.limit ?? maxResults
  if (limit > 0) {
    files = files.slice(0, limit)
  }

  return files
}

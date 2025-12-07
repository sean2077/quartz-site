import { QuartzTransformerPlugin } from "../types"
import { ProcessedContent } from "../vfile"
import { Root } from "hast"

/**
 * Global storage for folder notes content
 * This allows FolderNotePage emitter to access folder notes even after they are filtered
 */
const folderNotesStore: Map<string, ProcessedContent> = new Map()

/**
 * Check if a slug represents a folder note (folder/folder.md pattern)
 */
export function isFolderNoteSlug(slug: string): boolean {
  const parts = slug.split("/")
  if (parts.length < 2) return false

  const fileName = parts[parts.length - 1]
  const folderName = parts[parts.length - 2]

  return fileName === folderName
}

/**
 * Get the folder path from a folder note slug
 * e.g., "some/path/folder/folder" -> "some/path/folder"
 */
export function getFolderFromFolderNoteSlug(slug: string): string {
  const parts = slug.split("/")
  return parts.slice(0, -1).join("/")
}

/**
 * Get stored folder note content for a folder
 */
export function getFolderNoteContent(folder: string): ProcessedContent | undefined {
  return folderNotesStore.get(folder)
}

/**
 * Clear the folder notes store (useful for watch mode rebuilds)
 */
export function clearFolderNotesStore(): void {
  folderNotesStore.clear()
}

/**
 * Get all stored folder notes
 */
export function getAllFolderNotes(): Map<string, ProcessedContent> {
  return folderNotesStore
}

/**
 * MarkFolderNotes transformer plugin
 *
 * Identifies and marks folder notes (folder/folder.md pattern).
 * Stores them in a global store for access by FolderNotePage emitter.
 * Also sets file.data.isFolderNote for use by filters.
 */
export const MarkFolderNotes: QuartzTransformerPlugin = () => {
  return {
    name: "MarkFolderNotes",
    htmlPlugins() {
      return [
        () => {
          return (_tree: Root, file) => {
            const slug = file.data.slug
            if (!slug) return

            if (isFolderNoteSlug(slug)) {
              // Mark the file as a folder note
              file.data.isFolderNote = true
              file.data.folderNotePath = getFolderFromFolderNoteSlug(slug)

              // Store the content for later use by FolderNotePage
              // Note: We need to store a reference that will be updated after HTML processing
              // So we use a deferred storage approach
            }
          }
        },
      ]
    },
  }
}

/**
 * StoreFolderNotes transformer plugin
 *
 * This should run AFTER all other transformers to capture the final processed content.
 * It stores folder notes in the global store for FolderNotePage to access.
 */
export const StoreFolderNotes: QuartzTransformerPlugin = () => {
  return {
    name: "StoreFolderNotes",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root, file) => {
            if (file.data.isFolderNote && file.data.folderNotePath) {
              // Store the folder note content
              // We need to store a copy since the tree might be modified later
              folderNotesStore.set(file.data.folderNotePath, [tree, file])
            }
          }
        },
      ]
    },
  }
}

// Extend vfile DataMap
declare module "vfile" {
  interface DataMap {
    isFolderNote: boolean
    folderNotePath: string
  }
}

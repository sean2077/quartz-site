import { QuartzTransformerPlugin } from "../types"
import { Root } from "hast"

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
 * MarkFolderNotes transformer plugin
 *
 * Identifies and marks folder notes (folder/folder.md pattern).
 * Sets file.data.isFolderNote and file.data.folderNotePath for use by FolderNotes filter.
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

import { QuartzFilterPlugin } from "../types"
import { ProcessedContent } from "../vfile"
import { getFolderFromFolderNoteSlug, isFolderNoteSlug } from "../transformers/folderNotes"

/**
 * Global storage for folder notes content
 * This is populated by the FolderNotes filter (running in main thread)
 * and accessed by the FolderNotePage emitter (also in main thread)
 */
const folderNotesStore: Map<string, ProcessedContent> = new Map()

/**
 * Get stored folder note content for a folder
 */
export function getFolderNoteContent(folder: string): ProcessedContent | undefined {
  return folderNotesStore.get(folder)
}

/**
 * Get all stored folder notes
 */
export function getAllFolderNotes(): Map<string, ProcessedContent> {
  return folderNotesStore
}

/**
 * Clear the folder notes store (useful for watch mode rebuilds)
 */
export function clearFolderNotesStore(): void {
  folderNotesStore.clear()
}

/**
 * FolderNotes filter plugin
 *
 * Filters out files that are marked as folder notes by the MarkFolderNotes transformer.
 * These files will be used as folder page content by the FolderNotePage emitter
 * instead of being published as separate pages.
 *
 * This filter also stores folder notes in a global store that can be accessed by
 * the FolderNotePage emitter. This works because both the filter and emitter run
 * in the main thread, so they share the same global state.
 *
 * Requires the MarkFolderNotes transformer to run first.
 */
export const FolderNotes: QuartzFilterPlugin = () => ({
  name: "FolderNotes",
  shouldPublish(_ctx, [tree, vfile]) {
    const slug = vfile.data.slug

    // Check if this is a folder note (either marked by transformer or by slug pattern)
    const isFolderNote = vfile.data.isFolderNote || (slug && isFolderNoteSlug(slug))

    if (isFolderNote && slug) {
      // Store the folder note content for FolderNotePage to access
      const folderPath = getFolderFromFolderNoteSlug(slug)
      folderNotesStore.set(folderPath, [tree, vfile])

      // Don't publish as separate page
      return false
    }

    return true
  },
})

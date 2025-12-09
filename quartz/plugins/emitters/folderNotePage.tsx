import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { ProcessedContent, QuartzPluginData, defaultProcessedContent } from "../vfile"
import { FullPageLayout } from "../../cfg"
import path from "path"
import {
  FilePath,
  FullSlug,
  SimpleSlug,
  stripSlashes,
  joinSegments,
  pathToRoot,
  simplifySlug,
} from "../../util/path"
import {
  defaultListPageLayout,
  sharedPageComponents,
  defaultContentPageLayout,
} from "../../../quartz.layout"
import {
  FolderContent,
  Content,
  Graph,
  DesktopOnly,
  TableOfContents,
  Backlinks,
} from "../../components"
import { byNaturalOrderFolderFirst } from "../../components/PageList"
import { write } from "./helpers"
import { i18n, TRANSLATIONS } from "../../i18n"
import { BuildCtx } from "../../util/ctx"
import { StaticResources } from "../../util/resources"
import { getFolderNoteContent, getAllFolderNotes } from "../filters/folderNotes"
import { isFolderNoteSlug } from "../transformers/folderNotes"

interface FolderNotePageOptions extends FullPageLayout {
  sort?: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

async function* processFolderInfo(
  ctx: BuildCtx,
  folderInfo: Record<SimpleSlug, ProcessedContent>,
  allFiles: QuartzPluginData[],
  folderListOpts: FullPageLayout,
  contentOpts: FullPageLayout,
  resources: StaticResources,
) {
  // Clear ctx.trie so FolderContent rebuilds it with our allFiles (including folder notes)
  // This is necessary because ctx.trie might have been built by ContentPage without folder notes
  ctx.trie = undefined

  for (const [folder, folderContent] of Object.entries(folderInfo) as [
    SimpleSlug,
    ProcessedContent,
  ][]) {
    const indexSlug = joinSegments(folder, "index") as FullSlug
    const [tree, file] = folderContent
    const cfg = ctx.cfg.configuration
    const externalResources = pageResources(pathToRoot(indexSlug), resources)

    // Create a folder page data entry with the correct slug (folder/index)
    // Ensure filePath is set for trie building (trieFromAllFiles requires it)
    const folderPageData: QuartzPluginData = {
      ...file.data,
      slug: indexSlug,
      filePath: file.data.filePath ?? (`${folder}/index.md` as FilePath),
    }

    // Check if this folder has child files in allFiles
    // If it's a folder note with no siblings, use content layout instead of folder list layout
    const folderPrefix = folder + "/"
    const hasChildFiles = allFiles.some(
      (f) => f.slug && f.slug.startsWith(folderPrefix) && f.slug !== indexSlug,
    )

    // Choose the appropriate layout based on whether we have child files
    const opts = hasChildFiles ? folderListOpts : contentOpts

    const componentData: QuartzComponentProps = {
      ctx,
      fileData: folderPageData,
      externalResources,
      cfg,
      children: [],
      tree,
      allFiles: [...allFiles, folderPageData],
    }

    const content = renderPage(cfg, indexSlug, componentData, opts, externalResources)

    // Generate folder/index.html (the actual folder page)
    yield write({
      ctx,
      content,
      slug: indexSlug,
      ext: ".html",
    })

    // Also generate folder.html that redirects to folder/
    // This handles Explorer links that point to the folder itself (e.g., /some/folder)
    const folderSlug = folder as unknown as FullSlug
    const folderName = folder.split("/").pop() || folder
    const redirectContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0; url=${folderName}/">
  <link rel="canonical" href="${folderName}/" />
</head>
<body>
  <p>Redirecting to <a href="${folderName}/">folder page</a>...</p>
  <script>window.location.href = "${folderName}/";</script>
</body>
</html>`
    yield write({
      ctx,
      content: redirectContent,
      slug: folderSlug,
      ext: ".html",
    })
  }
}

/**
 * Compute folder info with support for Obsidian-style folder notes (folder/folder.md)
 *
 * This function extends the original FolderPage behavior:
 * 1. It first looks for folder/folder.md files from the global store
 * 2. Falls back to folder/index.md if no folder note exists
 * 3. Creates a default folder page if neither exists
 */
function computeFolderInfo(
  folders: Set<SimpleSlug>,
  content: ProcessedContent[],
  locale: keyof typeof TRANSLATIONS,
): Record<SimpleSlug, ProcessedContent> {
  // Create default folder descriptions
  const folderInfo: Record<SimpleSlug, ProcessedContent> = Object.fromEntries(
    [...folders].map((folder) => [
      folder,
      defaultProcessedContent({
        slug: joinSegments(folder, "index") as FullSlug,
        frontmatter: {
          title: `${i18n(locale).pages.folderContent.folder}: ${folder}`,
          tags: [],
        },
      }),
    ]),
  )

  // First, look for folder notes from the global store
  for (const folder of folders) {
    const folderNoteContent = getFolderNoteContent(folder)
    if (folderNoteContent) {
      folderInfo[folder] = folderNoteContent
    }
  }

  // Then, check for index.md files (original Quartz behavior)
  // Only override if we haven't already found a folder note
  for (const [tree, file] of content) {
    const slug = stripSlashes(simplifySlug(file.data.slug!)) as SimpleSlug
    if (folders.has(slug)) {
      // Only use index.md if we don't already have a folder note
      const existingContent = folderInfo[slug]
      if (existingContent) {
        const existingSlug = existingContent[1].data.slug
        // Check if existing is default (synthetic) or already a folder note
        if (!existingSlug || !isFolderNoteSlug(existingSlug)) {
          // Keep existing if it's a folder note, otherwise use index.md
          if (!existingSlug) {
            folderInfo[slug] = [tree, file]
          }
        }
      }
    }
  }

  return folderInfo
}

function _getFolders(slug: FullSlug): SimpleSlug[] {
  var folderName = path.dirname(slug ?? "") as SimpleSlug
  const parentFolderNames = [folderName]

  while (folderName !== ".") {
    folderName = path.dirname(folderName ?? "") as SimpleSlug
    parentFolderNames.push(folderName)
  }
  return parentFolderNames
}

/**
 * FolderNotePage emitter plugin
 *
 * An enhanced version of FolderPage that supports Obsidian-style folder notes.
 * When a folder contains a file with the same name as the folder (folder/folder.md),
 * that file's content will be used as the folder page instead of generating a default listing.
 *
 * This plugin also supports the original index.md pattern as a fallback.
 *
 * For folders that only contain a folder note (no other files), it uses a content page layout
 * instead of a folder listing layout.
 */
export const FolderNotePage: QuartzEmitterPlugin<Partial<FolderNotePageOptions>> = (userOpts) => {
  // Layout for folders with child files (shows folder content list)
  // Use natural order sorting by default to handle numbered titles like "01.栈", "10.ST 表"
  const folderListOpts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: FolderContent({ sort: userOpts?.sort ?? byNaturalOrderFolderFirst() }),
    right: [Graph(), DesktopOnly(TableOfContents()), Backlinks()],
    ...userOpts,
  }

  // Layout for folder notes without siblings (shows content only, like a regular page)
  const contentOpts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, afterBody, left, right, footer: Footer } = folderListOpts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "FolderNotePage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        folderListOpts.pageBody,
        contentOpts.pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration

      // Get folders from content files
      const folders: Set<SimpleSlug> = new Set(
        allFiles.flatMap((data) => {
          return data.slug
            ? _getFolders(data.slug).filter(
                (folderName) => folderName !== "." && folderName !== "tags",
              )
            : []
        }),
      )

      // Also add folders from folder notes that were filtered out
      // This is important for folders that only contain a folder note
      const folderNotesMap = getAllFolderNotes()
      const folderNoteFiles: QuartzPluginData[] = []
      for (const [folderPath, [_tree, vfile]] of folderNotesMap.entries()) {
        const simpleSlug = folderPath as SimpleSlug
        if (simpleSlug !== "." && !simpleSlug.startsWith("tags")) {
          folders.add(simpleSlug)
          // Also add parent folders
          for (const parentFolder of _getFolders(folderPath as FullSlug)) {
            if (parentFolder !== "." && parentFolder !== "tags") {
              folders.add(parentFolder)
            }
          }
          // Add folder note data to be included in allFiles for trie building
          // Use the folder/index slug so it appears as a child of the parent folder
          const indexSlug = joinSegments(folderPath, "index") as FullSlug
          // Ensure filePath is set for trie building (trieFromAllFiles requires it)
          const filePath = vfile.data.filePath ?? (`${folderPath}/index.md` as FilePath)
          folderNoteFiles.push({
            ...vfile.data,
            slug: indexSlug,
            filePath,
          })
        }
      }

      // Combine regular files with folder note files for complete trie
      const allFilesWithFolderNotes = [...allFiles, ...folderNoteFiles]

      const folderInfo = computeFolderInfo(folders, content, cfg.locale)
      yield* processFolderInfo(
        ctx,
        folderInfo,
        allFilesWithFolderNotes,
        folderListOpts,
        contentOpts,
        resources,
      )
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration

      // Add folder notes to allFiles for complete trie
      const folderNotesMap = getAllFolderNotes()
      const folderNoteFiles: QuartzPluginData[] = []
      for (const [folderPath, [_tree, vfile]] of folderNotesMap.entries()) {
        const simpleSlug = folderPath as SimpleSlug
        if (simpleSlug !== "." && !simpleSlug.startsWith("tags")) {
          const indexSlug = joinSegments(folderPath, "index") as FullSlug
          // Ensure filePath is set for trie building (trieFromAllFiles requires it)
          const filePath = vfile.data.filePath ?? (`${folderPath}/index.md` as FilePath)
          folderNoteFiles.push({
            ...vfile.data,
            slug: indexSlug,
            filePath,
          })
        }
      }
      const allFilesWithFolderNotes = [...allFiles, ...folderNoteFiles]

      // Find all folders that need to be updated based on changed files
      const affectedFolders: Set<SimpleSlug> = new Set()
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue
        const slug = changeEvent.file.data.slug!
        const folders = _getFolders(slug).filter(
          (folderName) => folderName !== "." && folderName !== "tags",
        )
        folders.forEach((folder) => affectedFolders.add(folder))
      }

      // If there are affected folders, rebuild their pages
      if (affectedFolders.size > 0) {
        const folderInfo = computeFolderInfo(affectedFolders, content, cfg.locale)
        yield* processFolderInfo(
          ctx,
          folderInfo,
          allFilesWithFolderNotes,
          folderListOpts,
          contentOpts,
          resources,
        )
      }
    },
  }
}

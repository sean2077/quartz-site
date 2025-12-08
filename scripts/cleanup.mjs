import fs from "fs/promises"
import path from "path"
import { glob } from "glob"

// Configuration
const PUBLIC_DIR = "public"
const ASSET_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".webm",
  ".pdf",
  ".mp3",
  ".wav",
]
const WHITELIST = ["favicon.ico", "robots.txt", "sitemap.xml", "CNAME", ".nojekyll"]

async function cleanup() {
  console.log("🧹 Starting asset cleanup...")

  // 1. Find all HTML, CSS, JS files to scan for references
  const contentFiles = await glob(`${PUBLIC_DIR}/**/*.{html,css,js}`)
  const usedAssets = new Set()

  // 2. Scan content files for asset references
  for (const file of contentFiles) {
    const content = await fs.readFile(file, "utf-8")

    // Simple regex to find potential paths (this is a heuristic, not a perfect parser)
    // Matches: src="...", href="...", url(...)
    const matches = content.matchAll(/(?:src|href|url)\s*=\s*["']([^"']+)["']|url\(([^)]+)\)/g)

    for (const match of matches) {
      let ref = match[1] || match[2]
      if (!ref) continue

      // Clean up the reference (remove query params, hashes, quotes)
      ref = ref.split(/[?#]/)[0].replace(/['"]/g, "").trim()

      // Handle absolute paths (relative to root)
      if (ref.startsWith("/")) {
        ref = ref.substring(1) // Remove leading slash
      } else {
        // Handle relative paths? (Complex, skipping for now, assuming most assets are absolute or simple)
        // For Quartz, assets are usually linked as "static/..." or relative.
        // If relative, resolving is hard without knowing the file depth.
        // Strategy: Just match the filename? No, that's unsafe.
        // Strategy: If it looks like an asset path, keep it.
      }

      // Decode URI components (e.g. %20 -> space)
      try {
        ref = decodeURIComponent(ref)
      } catch (e) {}

      usedAssets.add(ref)
      usedAssets.add(path.basename(ref)) // Also add basename as a fallback for fuzzy matching
    }
  }

  // 3. Find all asset files in public dir
  const allAssets = await glob(`${PUBLIC_DIR}/**/*`)
  let deletedCount = 0

  for (const assetPath of allAssets) {
    const ext = path.extname(assetPath).toLowerCase()
    const relativePath = path.relative(PUBLIC_DIR, assetPath).replace(/\\/g, "/")
    const fileName = path.basename(assetPath)

    // Skip directories and non-asset files
    const stat = await fs.stat(assetPath)
    if (stat.isDirectory()) continue
    if (!ASSET_EXTENSIONS.includes(ext)) continue
    if (WHITELIST.includes(fileName)) continue

    // Check if used
    // We check if the full relative path OR the filename is referenced.
    // Checking filename is safer but might keep duplicates.
    if (!usedAssets.has(relativePath) && !usedAssets.has(fileName)) {
      // console.log(`  🗑️  Deleting unused: ${relativePath}`);
      // await fs.unlink(assetPath);
      // deletedCount++;
      console.log(`  ⚠️  [Dry Run] Would delete: ${relativePath}`)
    }
  }

  console.log(`✨ Cleanup complete. Found ${deletedCount} unused assets.`)
  console.log(`Note: Uncomment the deletion lines in the script to actually delete files.`)
}

cleanup().catch(console.error)

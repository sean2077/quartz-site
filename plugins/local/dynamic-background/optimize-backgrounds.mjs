import { stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

// From the repository root: node plugins/local/dynamic-background/optimize-backgrounds.mjs
// Keep the source artwork intact. Only these display variants are used by the component.
const artwork = new URL("../../../quartz/static/A day in the corner of the city/", import.meta.url)
const sources = {
  dawn: "dawn.png",
  morning: "morning.png",
  noon: "noon.jpg",
  afternoon: "afternoon.png",
  dusk: "dusk.jpg",
  night: "night.jpg",
}

for (const [phase, filename] of Object.entries(sources)) {
  const source = new URL(filename, artwork)
  const sourceBytes = (await stat(source)).size
  for (const width of [800, 1600]) {
    const output = new URL(`${phase}-${width}.webp`, artwork)
    const { size } = await sharp(fileURLToPath(source))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 6 })
      .toFile(fileURLToPath(output))
    console.log(
      `${phase}-${width}.webp: ${size} bytes (${(100 * (1 - size / sourceBytes)).toFixed(1)}% smaller)`,
    )
  }
}

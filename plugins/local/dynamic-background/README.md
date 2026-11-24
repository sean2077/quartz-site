# Dynamic background

The component only owns the decorative image and local-time phase clock. Site layout, typography, and reading surfaces belong in `quartz/styles/custom.scss` so they remain consistent when this component is disabled.

The clock schedules the next phase boundary (05:00, 07:00, 12:00, 14:00, 17:00, or 19:00), pauses in hidden tabs, and resumes after a back/forward cache restore. It persists through SPA navigation.

## Display images

Original artwork remains in `quartz/static/A day in the corner of the city/`. CSS selects an 800 px WebP on viewports up to 800 px wide and a 1600 px WebP elsewhere. URLs are relative to the generated `index.css`, supporting sites hosted under a subpath. Only the current phase's image is requested.

To regenerate the checked-in display variants using the existing `sharp` dependency, run from the repository root:

```sh
node plugins/local/dynamic-background/optimize-backgrounds.mjs
```

With the current six source images, originals total 16,547,108 bytes. The six desktop variants total 978,850 bytes and the six mobile variants total 341,170 bytes. These are aggregate file sizes across all phases, not a per-page transfer measurement. Each selected desktop image is 148–176 kB, or 54–59 kB on mobile. Originals are retained for future regeneration and remain part of the static output, but the component does not request them.

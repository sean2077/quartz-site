// Obsidian Bases client-side interactivity

document.addEventListener("nav", async () => {
  // Initialize tab switching for multi-view bases
  initTabSwitching()

  // Initialize map views (if Leaflet is available)
  await initMapViews()

  // Initialize client-side table sorting
  initTableSorting()
})

/**
 * Initialize tab switching for bases with multiple views
 */
function initTabSwitching() {
  const containers = document.querySelectorAll(".base-container")

  for (const container of containers) {
    const tabs = container.querySelectorAll(".base-tab") as NodeListOf<HTMLButtonElement>
    const views = container.querySelectorAll(".base-view-container") as NodeListOf<HTMLElement>

    if (tabs.length === 0 || views.length === 0) continue

    tabs.forEach((tab, index) => {
      const handler = () => {
        // Deactivate all tabs and views
        tabs.forEach((t) => t.classList.remove("active"))
        views.forEach((v) => v.classList.remove("active"))

        // Activate clicked tab and corresponding view
        tab.classList.add("active")
        if (views[index]) {
          views[index].classList.add("active")
        }
      }

      tab.addEventListener("click", handler)
      window.addCleanup(() => tab.removeEventListener("click", handler))
    })
  }
}

/**
 * Initialize Leaflet map views
 */
async function initMapViews() {
  const mapContainers = document.querySelectorAll(".base-view.base-map") as NodeListOf<HTMLElement>
  if (mapContainers.length === 0) return

  // Check if Leaflet is available
  // @ts-ignore - Leaflet is loaded dynamically
  if (!window.L) {
    // Try to load Leaflet dynamically
    try {
      await loadLeaflet()
    } catch {
      console.warn("[ObsidianBases] Leaflet not available, map views will not be rendered")
      return
    }
  }

  // @ts-ignore - Leaflet is loaded dynamically
  const L = window.L

  for (const container of mapContainers) {
    const markersData = container.dataset.markers
    if (!markersData) continue

    try {
      const markers = JSON.parse(markersData) as Array<{
        lat: number
        lng: number
        title: string
        href: string
      }>

      const mapContainer = container.querySelector(".base-map-container") as HTMLElement
      if (!mapContainer) continue

      // Skip if already initialized
      if (mapContainer.dataset.initialized === "true") continue

      // Create map
      const map = L.map(mapContainer).setView([0, 0], 2)

      // Add tile layer (OpenStreetMap)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      // Add markers
      const bounds = L.latLngBounds([])

      for (const m of markers) {
        const marker = L.marker([m.lat, m.lng]).bindPopup(
          `<a href="${m.href}" class="internal">${m.title}</a>`,
        )
        marker.addTo(map)
        bounds.extend([m.lat, m.lng])
      }

      // Fit bounds if we have markers
      if (markers.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] })
      }

      mapContainer.dataset.initialized = "true"

      // Cleanup on navigation
      window.addCleanup(() => {
        map.remove()
        mapContainer.dataset.initialized = "false"
      })
    } catch (e) {
      console.error("[ObsidianBases] Error initializing map:", e)
    }
  }
}

/**
 * Load Leaflet CSS and JS dynamically
 */
async function loadLeaflet(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    // @ts-ignore - Leaflet is loaded dynamically
    if (window.L) {
      resolve()
      return
    }

    // Load CSS
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)

    // Load JS
    const script = document.createElement("script")
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Leaflet"))
    document.head.appendChild(script)
  })
}

/**
 * Initialize client-side table sorting
 */
function initTableSorting() {
  const tables = document.querySelectorAll(
    ".base-view.base-table table",
  ) as NodeListOf<HTMLTableElement>

  for (const table of tables) {
    const headers = table.querySelectorAll("th") as NodeListOf<HTMLTableCellElement>
    const tbody = table.querySelector("tbody")
    if (!tbody) continue

    headers.forEach((th, colIndex) => {
      const handler = () => {
        const rows = Array.from(tbody.querySelectorAll("tr"))

        // Determine sort direction
        const currentSort = th.dataset.sort
        const newSort = currentSort === "asc" ? "desc" : "asc"

        // Clear other headers' sort state
        headers.forEach((h) => delete h.dataset.sort)
        th.dataset.sort = newSort

        // Sort rows
        rows.sort((a, b) => {
          const aCell = a.cells[colIndex]
          const bCell = b.cells[colIndex]
          if (!aCell || !bCell) return 0

          // Get text content, preferring link text
          const aText = (aCell.querySelector("a")?.textContent || aCell.textContent || "").trim()
          const bText = (bCell.querySelector("a")?.textContent || bCell.textContent || "").trim()

          // Try numeric comparison first
          const aNum = parseFloat(aText)
          const bNum = parseFloat(bText)

          if (!isNaN(aNum) && !isNaN(bNum)) {
            return newSort === "asc" ? aNum - bNum : bNum - aNum
          }

          // Fall back to string comparison
          const comparison = aText.localeCompare(bText, undefined, {
            numeric: true,
            sensitivity: "base",
          })
          return newSort === "asc" ? comparison : -comparison
        })

        // Re-append rows in sorted order
        for (const row of rows) {
          tbody.appendChild(row)
        }
      }

      th.addEventListener("click", handler)
      window.addCleanup(() => th.removeEventListener("click", handler))
    })
  }
}

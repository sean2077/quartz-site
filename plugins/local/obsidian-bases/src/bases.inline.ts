// Obsidian Bases client-side interactivity

document.addEventListener("nav", async () => {
  // Initialize tab switching for multi-view bases
  initTabSwitching()

  // Initialize map views (if Leaflet is available)
  await initMapViews()

  // Initialize client-side table sorting
  initTableSorting()

  // Initialize paginated tables
  initPaginatedTables()
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

/**
 * Debounce helper. Returns the debounced function and a cancel function.
 */
function debounce(fn: () => void, ms: number): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>
  return {
    call: () => {
      clearTimeout(timer)
      timer = setTimeout(fn, ms)
    },
    cancel: () => clearTimeout(timer),
  }
}

/**
 * Natural sort comparison for table cells
 */
function naturalCompare(aText: string, bText: string, dir: "asc" | "desc"): number {
  // Empty values always sort to end
  if (!aText && !bText) return 0
  if (!aText) return 1
  if (!bText) return -1

  // Try numeric comparison first
  const aNum = parseFloat(aText)
  const bNum = parseFloat(bText)
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return dir === "asc" ? aNum - bNum : bNum - aNum
  }

  const comparison = aText.localeCompare(bText, undefined, {
    numeric: true,
    sensitivity: "base",
  })
  return dir === "asc" ? comparison : -comparison
}

/**
 * Initialize paginated tables with search, sort, pagination, and quick-filter
 */
function initPaginatedTables() {
  const containers = document.querySelectorAll(".base-paginated-table") as NodeListOf<HTMLElement>

  for (const container of containers) {
    // Skip if already initialized
    if (container.dataset.initialized === "true") continue

    const tbodyEl = container.querySelector("tbody")
    if (!tbodyEl) continue
    const tbody: HTMLTableSectionElement = tbodyEl

    const allRows = Array.from(tbody.querySelectorAll("tr")) as HTMLTableRowElement[]

    // State
    let currentPage = 0
    let pageSize = parseInt(container.dataset.pageSize ?? "25", 10) || 25
    let searchTerm = ""
    const activeFilters = new Map<string, string>() // col -> value
    let sortCol = -1
    let sortDir: "asc" | "desc" = "asc"

    // DOM references
    const searchInput = container.querySelector(".bpt-search") as HTMLInputElement | null
    const prevBtn = container.querySelector(".bpt-prev") as HTMLButtonElement | null
    const nextBtn = container.querySelector(".bpt-next") as HTMLButtonElement | null
    const pageSizeSelect = container.querySelector(
      ".bpt-page-size-select",
    ) as HTMLSelectElement | null
    const pageInfo = container.querySelector(".bpt-page-info") as HTMLElement | null
    const filtersContainer = container.querySelector(".bpt-active-filters") as HTMLElement | null
    const headers = container.querySelectorAll("th") as NodeListOf<HTMLTableCellElement>

    // Build property-name → display-name map from table headers
    const displayNames = new Map<string, string>()
    headers.forEach((th) => {
      const prop = th.dataset.property
      if (prop) displayNames.set(prop, th.textContent?.trim() ?? prop)
    })

    /**
     * Core update: filter → sort → paginate → render
     */
    function updateView() {
      // 1. Filter
      let visibleRows = [...allRows]

      if (searchTerm) {
        visibleRows = visibleRows.filter((row) => {
          const searchable = row.dataset.searchable ?? ""
          return searchable.includes(searchTerm)
        })
      }

      if (activeFilters.size > 0) {
        visibleRows = visibleRows.filter((row) => {
          for (const [col, val] of activeFilters) {
            const cell = row.querySelector(
              `td[data-col="${CSS.escape(col)}"]`,
            ) as HTMLElement | null
            if (!cell || cell.dataset.value !== val) return false
          }
          return true
        })
      }

      // 2. Sort
      if (sortCol >= 0) {
        visibleRows.sort((a, b) => {
          const aCell = a.cells[sortCol]
          const bCell = b.cells[sortCol]
          if (!aCell || !bCell) return 0
          const aText = (aCell.querySelector("a")?.textContent || aCell.textContent || "").trim()
          const bText = (bCell.querySelector("a")?.textContent || bCell.textContent || "").trim()
          return naturalCompare(aText, bText, sortDir)
        })
        // Re-append in sorted order
        for (const row of visibleRows) {
          tbody.appendChild(row)
        }
      }

      // 3. Paginate
      const totalVisible = visibleRows.length
      const totalPages = Math.max(1, Math.ceil(totalVisible / pageSize))
      if (currentPage >= totalPages) currentPage = totalPages - 1
      if (currentPage < 0) currentPage = 0
      const start = currentPage * pageSize
      const end = Math.min(start + pageSize, totalVisible)

      // Build set for quick lookup
      const pageSet = new Set(visibleRows.slice(start, end))

      for (const row of allRows) {
        row.hidden = !pageSet.has(row)
      }

      // 4. Update controls
      if (pageInfo) {
        if (totalVisible === 0) {
          pageInfo.textContent = "No results"
        } else {
          pageInfo.textContent = `${start + 1}-${end} of ${totalVisible}`
        }
      }
      if (prevBtn) prevBtn.disabled = currentPage === 0
      if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1

      // 5. Render filter chips using safe DOM methods
      if (filtersContainer) {
        filtersContainer.replaceChildren()
        for (const [col, val] of activeFilters) {
          const chip = document.createElement("button")
          chip.className = "bpt-filter-chip"
          chip.type = "button"
          chip.ariaLabel = `Remove filter: ${displayNames.get(col) ?? col} = ${val}`

          const label = document.createTextNode(`${displayNames.get(col) ?? col}: ${val} `)
          chip.appendChild(label)

          const removeIcon = document.createElement("span")
          removeIcon.className = "bpt-chip-remove"
          removeIcon.textContent = "\u00d7"
          removeIcon.ariaHidden = "true"
          chip.appendChild(removeIcon)

          chip.addEventListener("click", () => {
            activeFilters.delete(col)
            currentPage = 0
            updateView()
          })
          filtersContainer.appendChild(chip)
        }
      }
    }

    // Search handler
    if (searchInput) {
      const search = debounce(() => {
        searchTerm = searchInput.value.toLowerCase().trim()
        currentPage = 0
        updateView()
      }, 300)
      const onSearchInput = () => search.call()
      searchInput.addEventListener("input", onSearchInput)
      window.addCleanup(() => {
        searchInput.removeEventListener("input", onSearchInput)
        search.cancel()
      })
    }

    // Pagination handlers
    if (prevBtn) {
      const handler = () => {
        if (currentPage > 0) {
          currentPage--
          updateView()
        }
      }
      prevBtn.addEventListener("click", handler)
      window.addCleanup(() => prevBtn.removeEventListener("click", handler))
    }

    if (nextBtn) {
      const handler = () => {
        if (nextBtn.disabled) return
        currentPage++
        updateView()
      }
      nextBtn.addEventListener("click", handler)
      window.addCleanup(() => nextBtn.removeEventListener("click", handler))
    }

    if (pageSizeSelect) {
      const handler = () => {
        pageSize = parseInt(pageSizeSelect.value, 10) || 25
        currentPage = 0
        updateView()
      }
      pageSizeSelect.addEventListener("change", handler)
      window.addCleanup(() => pageSizeSelect.removeEventListener("change", handler))
    }

    // Column sort handlers
    headers.forEach((th, colIndex) => {
      const handler = () => {
        if (sortCol === colIndex) {
          sortDir = sortDir === "asc" ? "desc" : "asc"
        } else {
          sortCol = colIndex
          sortDir = "asc"
        }
        // Update sort indicators
        headers.forEach((h) => delete h.dataset.sort)
        th.dataset.sort = sortDir
        currentPage = 0
        updateView()
      }
      th.addEventListener("click", handler)
      window.addCleanup(() => th.removeEventListener("click", handler))
    })

    // Quick-filter: click a cell to filter by its value
    const cellClickHandler = (e: Event) => {
      const target = e.target as HTMLElement
      // Don't capture clicks on links
      if (target.closest("a")) return

      const td = target.closest("td") as HTMLElement | null
      if (!td || !td.dataset.col || !td.dataset.value) return

      const col = td.dataset.col
      const val = td.dataset.value

      // Toggle: if same filter is active, remove it
      if (activeFilters.get(col) === val) {
        activeFilters.delete(col)
      } else {
        activeFilters.set(col, val)
      }
      currentPage = 0
      updateView()
    }
    tbody.addEventListener("click", cellClickHandler)
    window.addCleanup(() => tbody.removeEventListener("click", cellClickHandler))

    // Mark as initialized
    container.dataset.initialized = "true"
    window.addCleanup(() => {
      container.dataset.initialized = "false"
    })

    // Initial render
    updateView()
  }
}

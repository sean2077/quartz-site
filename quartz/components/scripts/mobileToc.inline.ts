// Mobile TOC and Back to Top interaction script

function setupMobileToc() {
  const toggleBtn = document.querySelector(".mobile-toc-toggle") as HTMLButtonElement | null
  const closeBtn = document.querySelector(".mobile-toc-close") as HTMLButtonElement | null
  const panel = document.querySelector(".mobile-toc-panel") as HTMLElement | null
  const backdrop = document.querySelector(".mobile-toc-backdrop") as HTMLElement | null
  const backToTopBtn = document.querySelector(".mobile-back-to-top") as HTMLButtonElement | null

  if (!toggleBtn || !panel || !backdrop) return

  const openToc = () => {
    panel.classList.add("active")
    backdrop.classList.add("active")
    document.body.style.overflow = "hidden"
  }

  const closeToc = () => {
    panel.classList.remove("active")
    backdrop.classList.remove("active")
    document.body.style.overflow = ""
  }

  // Toggle button click
  toggleBtn.addEventListener("click", openToc)

  // Close button click
  if (closeBtn) {
    closeBtn.addEventListener("click", closeToc)
  }

  // Backdrop click
  backdrop.addEventListener("click", closeToc)

  // Link click - close and scroll
  const tocLinks = panel.querySelectorAll("a")
  tocLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeToc()
    })
  })

  // Escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && panel.classList.contains("active")) {
      closeToc()
    }
  }
  document.addEventListener("keydown", handleEscape)

  // Back to top functionality
  if (backToTopBtn) {
    const scrollThreshold = 300 // Show button after scrolling 300px

    const handleScroll = () => {
      if (window.scrollY > scrollThreshold) {
        backToTopBtn.classList.add("visible")
      } else {
        backToTopBtn.classList.remove("visible")
      }
    }

    const scrollToTop = () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    backToTopBtn.addEventListener("click", scrollToTop)

    // Initial check
    handleScroll()

    // Cleanup for back to top
    window.addCleanup(() => {
      window.removeEventListener("scroll", handleScroll)
      backToTopBtn.removeEventListener("click", scrollToTop)
    })
  }

  // Cleanup
  window.addCleanup(() => {
    toggleBtn.removeEventListener("click", openToc)
    if (closeBtn) {
      closeBtn.removeEventListener("click", closeToc)
    }
    backdrop.removeEventListener("click", closeToc)
    tocLinks.forEach((link) => {
      link.removeEventListener("click", closeToc)
    })
    document.removeEventListener("keydown", handleEscape)
    document.body.style.overflow = ""
  })
}

document.addEventListener("nav", setupMobileToc)

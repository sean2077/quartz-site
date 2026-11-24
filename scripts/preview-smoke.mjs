import { access } from "node:fs/promises"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import handler from "serve-handler"

// Serve only the synthetic output. Never fall back to a production build or vault.
const publicDirectory = new URL("../.quartz/smoke-public/", import.meta.url)
try {
  await access(new URL("index.html", publicDirectory))
} catch {
  throw new Error("Synthetic site is missing. Run npm run test:smoke before browser tests.")
}

const server = createServer((request, response) => {
  void handler(request, response, {
    public: fileURLToPath(publicDirectory),
    cleanUrls: true,
    directoryListing: false,
  }).catch((error) => {
    console.error(error)
    if (!response.headersSent) response.writeHead(500)
    response.end("Unable to serve the synthetic site")
  })
})

server.listen(4173, "127.0.0.1", () => {
  console.log("Synthetic Quartz site: http://127.0.0.1:4173")
})
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

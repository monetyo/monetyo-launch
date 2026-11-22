// @ts-check
import { defineConfig, envField } from "astro/config"
import tailwindcss from "@tailwindcss/vite"
import icon from "astro-icon"

import { DEFAULT_LOCALE, LOCALES } from "./src/libs/i18n.ts"
import { SITE } from "./src/libs/site.ts"

/**
 * Redirects a page path without its trailing slash to the one with it, in
 * development only, the way Vercel does (`trailingSlash` in `vercel.json`).
 *
 * We decided to mirror the redirect rather than relax `trailingSlash`, because
 * the dev server would otherwise answer `/anything` with Astro's own 404
 * instead of the site's, and relaxing it would hide links Vercel redirects.
 * Paths with a file extension and the dev server's own (`/@vite`, `/_astro`…)
 * are left alone.
 *
 * @type {import("vite").Plugin}
 */
const trailingSlash = {
  name: "monetyo:trailing-slash",
  apply: "serve",
  configureServer(server) {
    // A post hook put first in the stack, so it runs ahead of Astro's own
    // handler, which goes first too and would answer with its 404.
    return () => {
      server.middlewares.stack.unshift({
        route: "",
        /**
         * @param {import("node:http").IncomingMessage} request
         * @param {import("node:http").ServerResponse} response
         * @param {() => void} next
         */
        handle: (request, response, next) => {
          const url = new URL(request.url ?? "/", "http://localhost")
          const { pathname } = url

          if (
            request.method !== "GET" ||
            pathname.endsWith("/") ||
            /^\/(@|_|node_modules\/|src\/)/.test(pathname) ||
            /\.[\w]+$/.test(pathname)
          ) {
            return next()
          }

          response.statusCode = 308
          response.setHeader("Location", `${pathname}/${url.search}`)
          response.end()
        },
      })
    }
  },
}

/**
 * Tells code whether it runs under the dev server, as
 * `import.meta.env.DEV_SERVER`, true for `astro dev` and false for
 * `astro build` whatever `NODE_ENV` says: the dev container sets it to
 * `development`, which Vite would otherwise read as a development build.
 *
 * @type {import("vite").Plugin}
 */
const devServer = {
  name: "monetyo:dev-server",
  config: (_, { command }) => ({
    define: {
      "import.meta.env.DEV_SERVER": JSON.stringify(command === "serve"),
    },
  }),
}

// @see https://astro.build/config
export default defineConfig({
  site: SITE,
  // Vercel redirects every path without one to its trailing-slash version
  // (`trailingSlash` in `vercel.json`), so the dev server refuses them too.
  trailingSlash: "always",
  env: {
    schema: {
      // Public by design: Cloudflare expects it in the page. Its secret
      // counterpart only ever reaches `api/waitlist`.
      TURNSTILE_SITE_KEY: envField.string({
        context: "client",
        access: "public",
      }),
    },
  },
  integrations: [icon()],
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss(), trailingSlash, devServer],
    build: { assetsInlineLimit: 0 },
  },
})

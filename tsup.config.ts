import { defineConfig } from 'tsup'

// Library build for the npm package `@epoch/mapper`.
// Bundles the React component, PDF export, and .epochmap codec.
// React / React-DOM stay external (peer deps).
export default defineConfig({
  // `index` is the client bundle (React editor); `server` is the server-safe
  // codec/types entry. Only `index` gets the "use client" banner (post-build).
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  dts: true,
  tsconfig: './tsconfig.build.json',
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom'],
  // The bundled entry is a client module (the editor uses React hooks). esbuild
  // strips module-level directives when bundling, so the `"use client"` banner
  // is re-applied by scripts/add-use-client.mjs as a post-build step.
})

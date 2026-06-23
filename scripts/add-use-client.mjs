// Ensures the bundled library entry keeps the `"use client"` directive at the
// very top. esbuild drops module-level directives when bundling, so we prepend
// it here as a guaranteed post-build step. The editor uses React hooks and must
// be a client module when imported into a React Server Components tree.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const file = new URL('../dist/index.js', import.meta.url)
if (!existsSync(file)) {
  console.error('add-use-client: dist/index.js not found — run tsup first')
  process.exit(1)
}

const directive = '"use client";\n'
const src = readFileSync(file, 'utf8')
if (!src.startsWith(directive)) {
  writeFileSync(file, directive + src)
  console.log('add-use-client: prepended "use client" to dist/index.js')
} else {
  console.log('add-use-client: directive already present')
}

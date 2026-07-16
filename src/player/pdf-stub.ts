/**
 * Player-build stub for `@/lib/dungeon-export`.
 *
 * The standalone player never exposes "Export PDF" (the editor toolbar and
 * activity bar are hidden in distribution mode), but it reuses `DungeonMapper`,
 * which statically imports `exportMapsAsPdf`. Pulling in the real module would
 * drag jsPDF + html2canvas + canvg + dompurify + svg-pathdata (~658 KB, ~40% of
 * the bundle) into every shipped game for a feature no player can reach.
 *
 * `scripts/build-player.mjs` aliases `@/lib/dungeon-export` to this file so the
 * PDF toolchain is excluded from the player. The editor's Next.js build is
 * untouched and still exports PDFs normally. This keeps the exact same export
 * signature so the swap is transparent to the bundler.
 *
 * Only esbuild ever resolves to this file (via the alias in build-player.mjs);
 * the type checker always sees the real module, so the stub needn't restate the
 * parameters — extra call-site arguments are harmless at runtime.
 */

export async function exportMapsAsPdf(): Promise<void> {
  // Unreachable in the player UI; guard defensively rather than crash.
  console.warn('PDF export is only available in the Epoch Mapper editor, not the standalone player.')
}

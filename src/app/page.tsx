import { DungeonMapper } from '@/components/DungeonMapper'

// The `/` route is the entire product — a single-page, file-based editor.
// `layout="fill"` makes the grid fill the screen (standalone); embedders default
// to the locked 12×12 window.
export default function Home() {
  return <DungeonMapper layout="fill" />
}

import Link from 'next/link'
import { Map as MapIcon, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'About — Epoch Mapper',
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to the editor
        </Link>

        <div className="flex items-center gap-3">
          <MapIcon className="h-8 w-8 text-amber-400" />
          <h1 className="text-3xl font-bold">Epoch Mapper</h1>
        </div>

        <p className="text-white/70 leading-relaxed">
          Epoch Mapper is a free, open-source dungeon and world map editor built for retro gaming. Draw room layouts,
          mark shops, inns, bosses, and points of interest as you explore a game. Export your maps as a beautifully
          formatted PDF or as a compact <code className="text-amber-200">.epochmap</code> file you can share with other
          players.
        </p>

        <p className="text-white/70 leading-relaxed">
          It runs entirely in your browser — no login, no accounts, no server. Your work is auto-saved to this device
          and exported as files you own. Maps you save in <code className="text-amber-200">.epochmap</code> format embed
          all of their custom marker definitions, so anyone you share a file with sees the map exactly as you drew it.
        </p>

        <div className="rounded-xl border border-white/10 p-5 space-y-2">
          <h2 className="font-semibold text-amber-300">Using Epoch?</h2>
          <p className="text-white/70 leading-relaxed text-sm">
            Epoch Mapper powers the dungeon-mapping feature in{' '}
            <a href="https://github.com/northbridgetechnology/epoch" className="text-amber-300 hover:underline">
              Epoch
            </a>
            , the retro game library. If you use Epoch, your maps sync to your profile, attach to specific games, and are
            always one click away from your game drawer.
          </p>
        </div>

        <div className="text-sm text-white/40 space-y-1">
          <p>MIT licensed · Built with Next.js, TypeScript, and Tailwind CSS.</p>
          <p>
            Source:{' '}
            <a href="https://github.com/northbridgetechnology/epoch-mapper" className="text-amber-400/80 hover:underline">
              github.com/northbridgetechnology/epoch-mapper
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}

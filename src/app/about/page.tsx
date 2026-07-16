import Link from 'next/link'
import { Map as MapIcon, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'About — Epoch',
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
          <h1 className="text-3xl font-bold">Epoch</h1>
        </div>

        <p className="text-white/70 leading-relaxed">
          Epoch is a free, open-source first-person dungeon-crawler engine and authoring tool for retro gaming — in the
          tradition of Eye of the Beholder, Shin Megami Tensei, and Wizardry. Draw grid maps, build a full ruleset
          (classes, spells, items, enemies, NPCs, quests, events), and play the result in a pseudo-3D first-person view
          with turn-based combat, a party, music, and exploration hazards.
        </p>

        <p className="text-white/70 leading-relaxed">
          It runs entirely in your browser — no login, no accounts, no server. Your work is auto-saved to this device
          and exported as files you own. When a game is finished you can ship it as a standalone app — a single
          double-click <code className="text-amber-200">.html</code>, a hosted web build, or a native desktop binary —
          or export a print-ready PDF and a compact <code className="text-amber-200">.epochmap</code> file. Everything a
          game needs (maps, ruleset, baked audio, custom markers) travels inside that one file.
        </p>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5 space-y-2">
          <h2 className="font-semibold text-amber-300">☕ Enjoying Epoch?</h2>
          <p className="text-white/70 leading-relaxed text-sm">
            It&apos;s free and always will be — no accounts, no ads, no paywalls. If it&apos;s saved you time or
            you just appreciate the work, you can show your support by{' '}
            <a href="https://www.buymeacoffee.com/northbridgetechnology" className="text-amber-300 hover:underline">
              buying me a coffee
            </a>
            . Every cup helps keep the project going and is hugely appreciated. There&apos;s also a coffee button in
            the bottom-left corner. Thank you!
          </p>
        </div>

        <div className="rounded-xl border border-white/10 p-5 space-y-2">
          <h2 className="font-semibold text-white/70">How it was built</h2>
          <p className="text-white/60 leading-relaxed text-sm">
            Epoch was built with heavy AI assistance, and I&apos;m happy to be upfront about it — including the
            engine&apos;s built-in pixel-art sprites, which are AI-generated placeholders you can replace with your own
            uploads in the editor. The music is synthesized chiptune, generated in-browser. It&apos;s all open source, so
            you never have to take my word for any of it — read the code, fork it, and judge the result for yourself.
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

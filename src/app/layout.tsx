import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { BuyMeACoffee } from '@/components/BuyMeACoffee'
import './globals.css'

const SITE_URL = 'https://epoch-engine.com'
const TAGLINE = 'Build & play first-person dungeon crawlers in your browser'
const DESCRIPTION =
  'Epoch is a free, open-source, in-browser engine for building and playing first-person ' +
  'dungeon crawlers — in the tradition of Eye of the Beholder, Wizardry, and Shin Megami Tensei. ' +
  'Draw grid maps, build a full RPG (classes, spells, items, enemies, branching dialogue, quests) ' +
  'with no code, and play the result in pseudo-3D with turn-based combat. No install, no account. ' +
  'Export finished games as a single standalone HTML file, a hosted web build, or a desktop app.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `Epoch — ${TAGLINE}`,
    template: '%s · Epoch',
  },
  description: DESCRIPTION,
  applicationName: 'Epoch',
  authors: [{ name: 'Northbridge Technology' }],
  creator: 'Northbridge Technology',
  keywords: [
    'dungeon crawler maker', 'browser RPG builder', 'no-code RPG', 'make a dungeon crawler',
    'Eye of the Beholder engine', 'Wizardry', 'Shin Megami Tensei', 'first-person dungeon crawler',
    'grid map editor', 'RPG maker', 'open source game engine', 'in-browser game engine',
  ],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Epoch',
    title: `Epoch — ${TAGLINE}`,
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Epoch — a first-person dungeon crawler built in the browser' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Epoch — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
}

// Structured data — helps search engines understand this is a free web app.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Epoch',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any (modern web browser)',
  url: SITE_URL,
  description: DESCRIPTION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Organization', name: 'Northbridge Technology' },
  license: 'https://opensource.org/licenses/MIT',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          Loaded via <link> (not next/font) on purpose: the PDF export draws to a
          canvas that references the literal "Cinzel" font-family name. next/font
          rewrites family names to hashed values, which the canvas can't target.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Cinzel+Decorative:wght@700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className="antialiased">
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
        <BuyMeACoffee />
      </body>
    </html>
  )
}

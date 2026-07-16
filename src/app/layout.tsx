import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { BuyMeACoffee } from '@/components/BuyMeACoffee'
import './globals.css'

export const metadata: Metadata = {
  title: 'Epoch',
  description:
    'A free, open-source dungeon and world map editor for retro gaming. Draw room layouts, mark points of interest, and export to PDF or the compact .epochmap format.',
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
      </head>
      <body className="antialiased">
        {children}
        <Toaster theme="dark" position="bottom-right" richColors />
        <BuyMeACoffee />
      </body>
    </html>
  )
}

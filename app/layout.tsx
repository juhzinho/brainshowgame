import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Brain Show - Party Game 3D',
  description: 'Jogo de quiz multiplayer 3D para ate 20 jogadores! Responda perguntas, use sabotagens e conquiste o primeiro lugar!',
}

export const viewport: Viewport = {
  themeColor: '#0a0a1a',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased overflow-hidden`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

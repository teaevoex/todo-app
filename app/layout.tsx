import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AppProviders } from '@/components/providers/AppProviders'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'A full-featured todo application with priorities, recurring tasks, reminders, tags, templates, calendar view, and WebAuthn authentication.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-foreground antialiased">
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}

'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportTodos } from '@/lib/api/export-import'

interface ExportButtonProps {
  className?: string
}

export function ExportButton({ className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  async function handleExport() {
    setIsExporting(true)
    try {
      const blob = await exportTodos()

      const sgDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `todos-export-${sgDate}.json`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      aria-busy={isExporting}
      data-testid="export-button"
      className={className}
    >
      <Download className="mr-1 h-4 w-4" />
      {isExporting ? 'Exporting\u2026' : 'Export'}
    </Button>
  )
}

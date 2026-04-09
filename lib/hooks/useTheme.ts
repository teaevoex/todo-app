'use client'

import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from '@/components/providers/ThemeProvider'

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

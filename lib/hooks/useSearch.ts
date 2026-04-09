'use client'

import { useState } from 'react'
import { useDebounce } from './useDebounce'

export interface UseSearchReturn {
  searchQuery: string
  debouncedQuery: string
  setSearchQuery: (query: string) => void
  clearSearch: () => void
}

export function useSearch(initialQuery = ''): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const debouncedQuery = useDebounce(searchQuery, 300)

  function clearSearch() {
    setSearchQuery('')
  }

  return {
    searchQuery,
    debouncedQuery,
    setSearchQuery,
    clearSearch,
  }
}

'use client'

import { Search } from 'lucide-react'

interface SearchInlineButtonProps {
  onClick: () => void
  disabled?: boolean
}

export default function SearchInlineButton({ onClick, disabled }: SearchInlineButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="search-inline-btn"
      aria-label="Search"
    >
      <Search size={26} />
    </button>
  )
}

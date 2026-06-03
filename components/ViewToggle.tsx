'use client'

import { LayoutGrid, List } from 'lucide-react'

export type ViewMode = 'card' | 'table'

interface ViewToggleProps {
  viewMode: ViewMode
  onToggle: (mode: ViewMode) => void
}

export default function ViewToggle({ viewMode, onToggle }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="radiogroup" aria-label="View mode">
      <button
        onClick={() => onToggle('card')}
        className={`view-toggle-btn${viewMode === 'card' ? ' active' : ''}`}
        role="radio"
        aria-checked={viewMode === 'card'}
        title="Card view"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => onToggle('table')}
        className={`view-toggle-btn${viewMode === 'table' ? ' active' : ''}`}
        role="radio"
        aria-checked={viewMode === 'table'}
        title="Table view"
      >
        <List size={16} />
      </button>
    </div>
  )
}

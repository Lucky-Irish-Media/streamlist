'use client'

import { Monitor } from 'lucide-react'

interface StreamingServiceFilterProps {
  services: { id: string; name: string }[]
  selectedIds: Set<string>
  onChange: (ids: Set<string>) => void
}

export default function StreamingServiceFilter({
  services,
  selectedIds,
  onChange,
}: StreamingServiceFilterProps) {
  if (services.length === 0) return null

  const isAllSelected = selectedIds.size === 0

  return (
    <div className="streaming-filter">
      <button
        onClick={() => onChange(new Set())}
        className={`streaming-filter-btn ${isAllSelected ? 'active' : ''}`}
        title="Show all content regardless of streaming service"
      >
        <Monitor size={14} />
        <span>All Services</span>
      </button>
      {services.map(service => {
        const isActive = selectedIds.has(service.id)
        return (
          <button
            key={service.id}
            onClick={() => {
              const newSet = new Set(selectedIds)
              if (isActive) {
                newSet.delete(service.id)
              } else {
                newSet.add(service.id)
              }
              onChange(newSet)
            }}
            className={`streaming-filter-btn ${isActive ? 'active' : ''}`}
          >
            <span>{service.name}</span>
          </button>
        )
      })}
    </div>
  )
}

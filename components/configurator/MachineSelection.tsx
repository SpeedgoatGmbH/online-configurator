'use client'

import { useState } from 'react'
import { MACHINE_TYPES, MACHINE_SUMMARY, RECOMMENDED_CONFIGS } from './machineTypes'

interface MachineSelectionProps {
  onSelectMachine: (machineType: string, machineModel: string) => void
  selectedType?: string
  selectedModel?: string
}

export default function MachineSelection({ 
  onSelectMachine, 
  selectedType, 
  selectedModel 
}: MachineSelectionProps) {
  const [activeType, setActiveType] = useState<string | null>(selectedType || null)
  const [showRecommended, setShowRecommended] = useState(true)

  const handleTypeSelect = (typeCode: string) => {
    setActiveType(typeCode)
    setShowRecommended(false)
  }

  const handleModelSelect = (typeCode: string, modelId: string) => {
    onSelectMachine(typeCode, modelId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Select Your Real-Time Target Machine</h2>
        <p className="mt-2 text-slate-600">
          Choose from {MACHINE_SUMMARY.totalModels} machine models across {MACHINE_SUMMARY.typeCount} product families
        </p>
      </div>

      {/* Recommended Configurations */}
      {showRecommended && (
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h3 className="text-lg font-semibold text-blue-900">Recommended Configurations</h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {RECOMMENDED_CONFIGS.map((config) => (
              <button
                key={config.model}
                onClick={() => handleModelSelect(config.type, config.model)}
                className="group rounded-lg border-2 border-blue-300 bg-white p-4 text-left transition hover:border-blue-500 hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between">
                  <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                    POPULAR
                  </span>
                  <svg 
                    className="h-4 w-4 text-blue-400 opacity-0 transition group-hover:opacity-100" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900">{config.name}</h4>
                <p className="mt-1 text-sm text-slate-600">{config.useCase}</p>
                <p className="mt-2 text-xs text-slate-500">{config.model}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Machine Type Grid */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">All Machine Families</h3>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MACHINE_TYPES.map((type) => {
            const count = MACHINE_SUMMARY.types[type.code as keyof typeof MACHINE_SUMMARY.types] || 0
            const isActive = activeType === type.code
            
            return (
              <button
                key={type.code}
                onClick={() => handleTypeSelect(type.code)}
                className={`group rounded-lg border-2 p-6 text-left transition ${
                  isActive
                    ? 'border-[rgb(var(--speedgoat-blue))] bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <h4 className={`text-lg font-bold ${ 
                    isActive ? 'text-[rgb(var(--speedgoat-blue))]' : 'text-slate-900'
                  }`}>
                    {type.displayName}
                  </h4>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}>
                    {count}
                  </span>
                </div>
                
                <p className="text-sm text-slate-600">{type.description}</p>
                
                {isActive && (
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[rgb(var(--speedgoat-blue))]">
                    <span>View Models</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Model Selection (shown when type is selected) */}
      {activeType && (
        <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              {MACHINE_TYPES.find(t => t.code === activeType)?.displayName} Models
            </h3>
            <button
              onClick={() => setActiveType(null)}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              ← Back to families
            </button>
          </div>
          
          <div className="rounded-lg border border-slate-300 bg-white p-6 text-center">
            <p className="text-slate-600">
              Model selection will be populated from database
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {MACHINE_SUMMARY.types[activeType as keyof typeof MACHINE_SUMMARY.types] || 0} models available
            </p>
            <button
              className="mt-4 rounded-lg bg-[rgb(var(--speedgoat-blue))] px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => {
                // For demo, select first model
                handleModelSelect(activeType, `${activeType}-001`)
                setShowRecommended(false)
              }}
            >
              Select Model
            </button>
          </div>
        </div>
      )}

      {/* Selected Machine Summary */}
      {selectedType && selectedModel && (
        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="font-semibold text-green-900">
                Machine Selected: {MACHINE_TYPES.find(t => t.code === selectedType)?.displayName} ({selectedModel})
              </p>
              <p className="text-sm text-green-700">Continue to configure I/O modules below</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

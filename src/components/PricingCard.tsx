'use client'

import { Check } from 'lucide-react'

interface PricingCardProps {
  name: string
  price: number | null
  features: string[]
  current: boolean
  popular?: boolean
  onSelect: () => void
  loading?: boolean
  disabled?: boolean
}

export default function PricingCard({
  name,
  price,
  features,
  current,
  popular = false,
  onSelect,
  loading = false,
  disabled = false,
}: PricingCardProps) {
  return (
    <div
      className={`
        relative rounded-2xl p-6
        ${popular
          ? 'bg-gradient-to-b from-blue-600/20 to-blue-600/5 border-2 border-blue-500'
          : 'bg-gray-800 border border-gray-700'
        }
        ${current ? 'ring-2 ring-green-500' : ''}
      `}
    >
      {/* Badge Populaire */}
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Populaire
          </span>
        </div>
      )}

      {/* Badge Actuel */}
      {current && (
        <div className="absolute -top-3 right-4">
          <span className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Actuel
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">{name}</h3>
        <div className="flex items-baseline justify-center">
          {price !== null ? (
            <>
              <span className="text-4xl font-extrabold text-white">{price}</span>
              <span className="text-gray-400 ml-1">/mois</span>
            </>
          ) : (
            <span className="text-2xl font-bold text-white">Sur devis</span>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-gray-300 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={onSelect}
        disabled={current || loading || disabled}
        className={`
          w-full py-3 px-4 rounded-lg font-semibold transition-all
          ${current
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : popular
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }
          ${loading ? 'opacity-50 cursor-wait' : ''}
          ${disabled && !current ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Chargement...
          </span>
        ) : current ? (
          'Plan actuel'
        ) : price === null ? (
          'Nous contacter'
        ) : (
          'Choisir ce plan'
        )}
      </button>
    </div>
  )
}

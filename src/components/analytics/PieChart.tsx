'use client'

interface Segment {
  label: string
  value: number
  color: string
}

interface PieChartProps {
  segments: Segment[]
  title?: string
  size?: number
  showLegend?: boolean
}

export default function PieChart({
  segments,
  title,
  size = 180,
  showLegend = true
}: PieChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)

  if (total === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        {title && <h3 className="text-white font-medium mb-4">{title}</h3>}
        <div
          className="flex items-center justify-center"
          style={{ height: size }}
        >
          <p className="text-gray-500">Aucune donnee</p>
        </div>
      </div>
    )
  }

  // Calculer les degres pour conic-gradient
  let currentAngle = 0
  const gradientStops = segments.map(segment => {
    const percentage = (segment.value / total) * 100
    const startAngle = currentAngle
    currentAngle += percentage
    return `${segment.color} ${startAngle}% ${currentAngle}%`
  }).join(', ')

  const conicGradient = `conic-gradient(${gradientStops})`

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      {title && <h3 className="text-white font-medium mb-4">{title}</h3>}
      <div className="flex items-center gap-6">
        {/* Pie */}
        <div
          className="rounded-full flex-shrink-0 relative"
          style={{
            width: size,
            height: size,
            background: conicGradient
          }}
        >
          {/* Trou central pour effet donut */}
          <div
            className="absolute bg-gray-800 rounded-full"
            style={{
              width: size * 0.5,
              height: size * 0.5,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">{total}</span>
            </div>
          </div>
        </div>

        {/* Legende */}
        {showLegend && (
          <div className="flex flex-col gap-2">
            {segments.map((segment, i) => {
              const percentage = Math.round((segment.value / total) * 100)
              return (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-gray-300 text-sm">
                    {segment.label}
                  </span>
                  <span className="text-gray-500 text-sm ml-auto">
                    {percentage}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

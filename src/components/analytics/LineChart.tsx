'use client'

interface DataPoint {
  label: string
  value: number
}

interface LineChartProps {
  data: DataPoint[]
  label: string
  color?: string
  height?: number
  showGrid?: boolean
}

export default function LineChart({
  data,
  label,
  color = '#3b82f6',
  height = 200,
  showGrid = true
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-800 rounded-xl border border-gray-700"
        style={{ height }}
      >
        <p className="text-gray-500">Aucune donnee</p>
      </div>
    )
  }

  const maxValue = Math.max(...data.map(d => d.value), 1)
  const minValue = 0
  const range = maxValue - minValue

  // Padding pour le graphique
  const paddingTop = 20
  const paddingBottom = 40
  const paddingLeft = 50
  const paddingRight = 20

  const chartHeight = height - paddingTop - paddingBottom
  const chartWidth = 100 // Pourcentage

  // Calculer les points de la ligne
  const points = data.map((d, i) => {
    const x = paddingLeft + ((i / (data.length - 1)) * (chartWidth - paddingLeft - paddingRight))
    const y = paddingTop + chartHeight - ((d.value - minValue) / range) * chartHeight
    return { x: `${x}%`, y, rawX: x, rawY: y, ...d }
  })

  // Creer le path SVG
  const pathData = points.map((p, i) => {
    const command = i === 0 ? 'M' : 'L'
    return `${command} ${p.rawX} ${p.rawY}`
  }).join(' ')

  // Path pour le remplissage sous la courbe
  const fillPath = `${pathData} L ${points[points.length - 1].rawX} ${paddingTop + chartHeight} L ${points[0].rawX} ${paddingTop + chartHeight} Z`

  // Grille horizontale
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: paddingTop + chartHeight - (ratio * chartHeight),
    value: Math.round(minValue + ratio * range)
  }))

  // Labels pour l'axe X (afficher quelques dates)
  const xLabels = data.filter((_, i) =>
    i === 0 || i === Math.floor(data.length / 2) || i === data.length - 1
  )

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h3 className="text-white font-medium mb-4">{label}</h3>
      <div style={{ height }} className="relative">
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grille */}
          {showGrid && gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={`${paddingLeft}%`}
                y1={line.y}
                x2={`${chartWidth - paddingRight}%`}
                y2={line.y}
                stroke="#374151"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
              <text
                x={`${paddingLeft - 5}%`}
                y={line.y + 3}
                fill="#9ca3af"
                fontSize="8"
                textAnchor="end"
              >
                {line.value}
              </text>
            </g>
          ))}

          {/* Remplissage sous la courbe */}
          <path
            d={fillPath}
            fill={color}
            fillOpacity="0.1"
          />

          {/* Ligne principale */}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={`${p.rawX}%`}
              cy={p.rawY}
              r="3"
              fill={color}
              className="hover:r-5 transition-all cursor-pointer"
            >
              <title>{p.label}: {p.value}</title>
            </circle>
          ))}
        </svg>

        {/* Labels X */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-12 text-xs text-gray-500">
          {xLabels.map((d, i) => (
            <span key={i}>{d.label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

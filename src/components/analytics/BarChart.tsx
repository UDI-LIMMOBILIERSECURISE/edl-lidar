'use client'

interface DataItem {
  label: string
  value: number
  color?: string
}

interface BarChartProps {
  data: DataItem[]
  title?: string
  maxValue?: number
  valueFormatter?: (value: number) => string
  showValues?: boolean
  barColor?: string
}

export default function BarChart({
  data,
  title,
  maxValue,
  valueFormatter = (v) => String(v),
  showValues = true,
  barColor = '#3b82f6'
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
        {title && <h3 className="text-white font-medium mb-4">{title}</h3>}
        <div className="flex items-center justify-center h-32">
          <p className="text-gray-500">Aucune donnee</p>
        </div>
      </div>
    )
  }

  const max = maxValue ?? Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      {title && <h3 className="text-white font-medium mb-4">{title}</h3>}
      <div className="space-y-3">
        {data.map((item, i) => {
          const percentage = (item.value / max) * 100
          const color = item.color || barColor

          return (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300 truncate max-w-[60%]">
                  {item.label}
                </span>
                {showValues && (
                  <span className="text-gray-400 flex-shrink-0 ml-2">
                    {valueFormatter(item.value)}
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

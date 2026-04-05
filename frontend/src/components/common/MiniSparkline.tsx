import { useId } from 'react'

/** Lightweight SVG area sparkline (no recharts). */
export function MiniSparkline({
  data,
  color = '#2563eb',
  className = '',
  height = 64,
}: {
  data: { value: number }[]
  color?: string
  className?: string
  height?: number
}) {
  const gid = useId().replace(/:/g, '')
  if (!data.length) return null

  const w = 200
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 2
  const nh = height - pad * 2

  const coords = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2)
    const y = pad + nh - ((v - min) / range) * nh
    return [x, y] as const
  })

  const linePath = coords.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ')
  const areaPath = `${linePath} L ${coords[coords.length - 1][0]} ${height} L ${coords[0][0]} ${height} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className={`w-full h-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.25} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-fill-${gid})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export type ChartPoint = { x: string; y: number }
export type ChartSeries = { label: string; color: string; points: ChartPoint[] }

const W = 320
const H = 110
const PAD = { l: 30, r: 8, t: 8, b: 18 }

/** A small dependency-free line chart. Points are placed by date, so gaps stay gaps. */
export function LineChart({ title, series, format = (n: number) => String(Math.round(n * 10) / 10), emptyText = 'No data in this range yet.' }: {
  title: string
  series: ChartSeries[]
  format?: (n: number) => string
  emptyText?: string
}) {
  const all = series.flatMap((s) => s.points)
  return (
    <figure className="pg-chart">
      <figcaption>
        <strong>{title}</strong>
        {series.length > 1 && (
          <span className="pg-legend">
            {series.map((s) => (
              <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>
            ))}
          </span>
        )}
      </figcaption>
      {all.length === 0 ? (
        <p className="sheets-meta">{emptyText}</p>
      ) : (
        <Plot series={series} all={all} format={format} title={title} />
      )}
    </figure>
  )
}

function Plot({ series, all, format, title }: { series: ChartSeries[]; all: ChartPoint[]; format: (n: number) => string; title: string }) {
  const xs = all.map((p) => Date.parse(`${p.x.slice(0, 10)}T12:00:00Z`))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(0, ...all.map((p) => p.y))
  const rawMax = Math.max(...all.map((p) => p.y))
  const maxY = rawMax === minY ? minY + 1 : rawMax
  const px = (x: string) => {
    const t = Date.parse(`${x.slice(0, 10)}T12:00:00Z`)
    return PAD.l + (maxX === minX ? (W - PAD.l - PAD.r) / 2 : ((t - minX) / (maxX - minX)) * (W - PAD.l - PAD.r))
  }
  const py = (y: number) => PAD.t + (1 - (y - minY) / (maxY - minY)) * (H - PAD.t - PAD.b)
  const first = all.map((p) => p.x).sort()[0].slice(5, 10)
  const last = all.map((p) => p.x).sort().slice(-1)[0].slice(5, 10)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="pg-svg">
      <line x1={PAD.l} x2={W - PAD.r} y1={py(minY)} y2={py(minY)} className="pg-axis" />
      <line x1={PAD.l} x2={W - PAD.r} y1={py(maxY)} y2={py(maxY)} className="pg-axis pg-axis-faint" />
      <text x={PAD.l - 4} y={py(maxY) + 3} textAnchor="end" className="pg-tick">{format(maxY)}</text>
      <text x={PAD.l - 4} y={py(minY) + 3} textAnchor="end" className="pg-tick">{format(minY)}</text>
      <text x={PAD.l} y={H - 4} className="pg-tick">{first}</text>
      <text x={W - PAD.r} y={H - 4} textAnchor="end" className="pg-tick">{last}</text>
      {series.map((s) => {
        const pts = [...s.points].sort((a, b) => a.x.localeCompare(b.x))
        return (
          <g key={s.label}>
            {pts.length > 1 && (
              <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" points={pts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} />
            )}
            {pts.map((p) => (
              <circle key={p.x} cx={px(p.x)} cy={py(p.y)} r={pts.length > 40 ? 1.5 : 2.5} fill={s.color}>
                <title>{`${p.x.slice(0, 10)}: ${format(p.y)}`}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

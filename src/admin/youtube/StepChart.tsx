import { useEffect, useRef, useState } from 'react'
import {
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type Plugin,
} from 'chart.js'

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip)

export type StepSeries = {
  label: string
  /** `y` per point; `x` too when the x axis is numeric (`xType: 'linear'`). */
  points: { x: number | string; y: number | null }[]
  color: string
  fill?: boolean
  /** Points to mark with a dot, by index, and the dot's color. */
  marks?: { index: number; color: string }[]
}

/**
 * A stepped line chart in the site's chart style: each value holds as a
 * plateau, no slopes, a soft fill under a single series, no legend (the card
 * draws an HTML key), and colors rebuilt from the CSS tokens when the theme
 * changes. `guides` draws dashed vertical lines, e.g. where chapters start.
 */
export function StepChart({
  series,
  xType = 'category',
  xFormat,
  yFormat,
  yMax,
  guides = [],
  tooltipTitle,
  tooltipExtra,
  label,
  height = 220,
}: {
  series: StepSeries[]
  xType?: 'category' | 'linear'
  xFormat?: (value: number | string) => string
  yFormat?: (value: number) => string
  yMax?: number
  guides?: number[]
  tooltipTitle?: (index: number) => string
  tooltipExtra?: (index: number) => string | string[]
  label: string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [themeVersion, setThemeVersion] = useState(0)

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((v) => v + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    chartRef.current?.destroy()
    chartRef.current = null
    if (!canvasRef.current) return

    const style = getComputedStyle(document.documentElement)
    const gridColor = style.getPropertyValue('--border').trim() || 'rgba(127,127,127,0.15)'
    const tickColor = style.getPropertyValue('--text-muted').trim() || 'rgba(127,127,127,0.65)'
    const guideColor = style.getPropertyValue('--border-strong').trim() || 'rgba(127,127,127,0.35)'
    const surface = style.getPropertyValue('--surface').trim() || '#ffffff'

    const guideLines: Plugin<'line'> = {
      id: 'stepChartGuides',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart
        ctx.save()
        ctx.strokeStyle = guideColor
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        for (const value of guides) {
          const x = scales.x.getPixelForValue(value)
          if (x <= chartArea.left || x > chartArea.right) continue
          ctx.beginPath()
          ctx.moveTo(x, chartArea.top)
          ctx.lineTo(x, chartArea.bottom)
          ctx.stroke()
        }
        ctx.restore()
      },
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: xType === 'category' ? series[0]?.points.map((p) => p.x) : undefined,
        datasets: series.map((s) => {
          const marked = new Map((s.marks ?? []).map((m) => [m.index, m.color]))
          return {
            label: s.label,
            data: (xType === 'linear' ? s.points.map((p) => ({ x: Number(p.x), y: p.y })) : s.points.map((p) => p.y)) as never,
            borderColor: s.color,
            backgroundColor: `${s.color}26`,
            borderWidth: 2,
            fill: s.fill ?? false,
            stepped: 'middle' as const,
            spanGaps: true,
            clip: false as const,
            pointRadius: s.points.map((_, i) => (marked.has(i) ? 4.5 : 0)),
            pointHoverRadius: 4,
            pointBackgroundColor: s.points.map((_, i) => marked.get(i) ?? s.color),
            pointBorderColor: surface,
            pointBorderWidth: 1.5,
          }
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        layout: { padding: { top: 8 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => (items[0] ? (tooltipTitle?.(items[0].dataIndex) ?? String(items[0].label)) : ''),
              label: (ctx) =>
                ` ${ctx.dataset.label}: ${yFormat ? yFormat(Number(ctx.parsed.y)) : ctx.formattedValue}`,
              afterBody: (items) => (items[0] && tooltipExtra ? tooltipExtra(items[0].dataIndex) : ''),
            },
          },
        },
        scales: {
          x: {
            type: xType,
            ...(xType === 'linear' ? { min: 0, max: Number(series[0]?.points.at(-1)?.x ?? 0) } : {}),
            ticks: {
              color: tickColor,
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7,
              callback(value) {
                const raw = xType === 'category' ? this.getLabelForValue(Number(value)) : Number(value)
                return xFormat ? xFormat(raw) : String(raw)
              },
            },
            grid: { display: false },
            border: { color: gridColor },
          },
          y: {
            min: 0,
            ...(yMax !== undefined ? { max: yMax } : {}),
            ticks: {
              color: tickColor,
              font: { size: 10 },
              maxTicksLimit: 5,
              callback: (value) => (yFormat ? yFormat(Number(value)) : String(value)),
            },
            grid: { color: gridColor },
            border: { display: false },
          },
        },
      },
      plugins: [guideLines],
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [series, xType, xFormat, yFormat, yMax, guides, tooltipTitle, tooltipExtra, themeVersion])

  return (
    <div className="yt-chart" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  )
}

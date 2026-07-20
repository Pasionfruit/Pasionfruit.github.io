import { useEffect, useRef, useState } from 'react'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { HourlyPoint } from './openMeteo'

// Self-register the pieces this mixed chart needs (register is idempotent, so
// this is safe alongside the app-wide registration in App.tsx).
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
)

function hourLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: 'numeric' })
}

export function HourlyChart({ points }: { points: HourlyPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [themeVersion, setThemeVersion] = useState(0)

  // Rebuild with fresh CSS-variable colors when the site theme toggles.
  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((v) => v + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    chartRef.current?.destroy()
    chartRef.current = null

    if (!canvasRef.current || points.length < 2) return

    const style = getComputedStyle(document.documentElement)
    const gridColor = style.getPropertyValue('--border').trim() || 'rgba(127,127,127,0.15)'
    const tickColor = style.getPropertyValue('--text-muted').trim() || 'rgba(127,127,127,0.65)'
    const tempColor = '#f97316'
    const precipColor = '#38bdf8'

    const labels = points.map((p) => hourLabel(p.time))
    const maxPrecip = Math.max(0.1, ...points.map((p) => p.precipitation))

    chartRef.current = new Chart(canvasRef.current, {
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: 'Temp',
            yAxisID: 'temp',
            data: points.map((p) => Math.round(p.temperature)),
            borderColor: tempColor,
            backgroundColor: tempColor + '22',
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointBackgroundColor: tempColor,
            order: 0,
          },
          {
            type: 'bar',
            label: 'Precip',
            yAxisID: 'precip',
            data: points.map((p) => p.precipitation),
            backgroundColor: precipColor + 'cc',
            borderRadius: 2,
            barPercentage: 0.6,
            categoryPercentage: 0.8,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => (items[0] ? `${labels[items[0].dataIndex]}` : ''),
              label: (ctx) => {
                if (ctx.dataset.label === 'Temp') {
                  return ` ${ctx.parsed.y}°F`
                }
                const point = points[ctx.dataIndex]
                return ` ${point.precipitation.toFixed(2)} in · ${point.precipitationProbability}%`
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: tickColor,
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
            },
            grid: { display: false },
            border: { color: gridColor },
          },
          temp: {
            position: 'left',
            ticks: { color: tickColor, font: { size: 10 }, callback: (v) => `${v}°` },
            grid: { color: gridColor },
            border: { color: gridColor },
          },
          precip: {
            position: 'right',
            min: 0,
            suggestedMax: maxPrecip,
            ticks: {
              color: tickColor,
              font: { size: 10 },
              maxTicksLimit: 4,
              callback: (v) => `${Number(v).toFixed(2)}"`,
            },
            grid: { display: false },
            border: { color: gridColor },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [points, themeVersion])

  return (
    <div className="weather-hourly-chart">
      <canvas ref={canvasRef} aria-label="Hourly temperature and precipitation chart" role="img" />
    </div>
  )
}

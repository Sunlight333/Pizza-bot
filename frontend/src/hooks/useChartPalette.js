import { useEffect, useState } from 'react'

import { useThemeStore } from '@/stores/theme'

/**
 * Reads the resolved CSS variables for chart colors so Recharts (which
 * needs literal string props) and any inline-styled chart components can
 * stay in sync with the active theme. Re-evaluates whenever the theme
 * flips.
 */
function readPalette() {
  if (typeof window === 'undefined') return defaultPalette()
  const cs = getComputedStyle(document.documentElement)
  const get = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback)
  return {
    stroke: get('--chart-stroke', '#3B82F6'),
    fillFrom: get('--chart-fill-from', 'rgba(59,130,246,0.55)'),
    fillTo: get('--chart-fill-to', 'rgba(59,130,246,0)'),
    grid: get('--chart-grid', '#E5E9F0'),
    axis: get('--chart-axis', '#94A3B8'),
    tooltipBg: get('--chart-tooltip-bg', 'rgba(255,255,255,0.96)'),
    tooltipBorder: get('--chart-tooltip-bdr', '#E5E9F0'),
    tooltipFg: get('--chart-tooltip-fg', '#0F172A'),
    heatmapEmpty: get('--heatmap-empty', '#EEF2F6'),
    heatmapFillRgb: get('--heatmap-fill-rgb', '59, 130, 246'),
  }
}

function defaultPalette() {
  return {
    stroke: '#3B82F6',
    fillFrom: 'rgba(59,130,246,0.55)',
    fillTo: 'rgba(59,130,246,0)',
    grid: '#E5E9F0',
    axis: '#94A3B8',
    tooltipBg: 'rgba(255,255,255,0.96)',
    tooltipBorder: '#E5E9F0',
    tooltipFg: '#0F172A',
    heatmapEmpty: '#EEF2F6',
    heatmapFillRgb: '59, 130, 246',
  }
}

export function useChartPalette() {
  const theme = useThemeStore((s) => s.theme)
  const [palette, setPalette] = useState(readPalette)
  useEffect(() => {
    // Wait one frame so the [data-theme] flip has propagated to the
    // computed styles before we re-read.
    const id = requestAnimationFrame(() => setPalette(readPalette()))
    return () => cancelAnimationFrame(id)
  }, [theme])
  return palette
}

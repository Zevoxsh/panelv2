// ANSI escape code → HTML converter for terminal output
// Handles SGR codes: colors (3/4-bit), bold, reset

const FG: Record<number, string> = {
  30: '#4b5563', // black → dark gray (visible on dark bg)
  31: '#f87171', // red
  32: '#4ade80', // green
  33: '#facc15', // yellow
  34: '#60a5fa', // blue
  35: '#e879f9', // magenta
  36: '#22d3ee', // cyan
  37: '#cbd5e1', // white
  // bright (bold / high-intensity)
  90: '#9ca3af', // bright black
  91: '#fca5a5', // bright red
  92: '#86efac', // bright green
  93: '#fde68a', // bright yellow
  94: '#93c5fd', // bright blue
  95: '#f5d0fe', // bright magenta
  96: '#a5f3fc', // bright cyan
  97: '#f8fafc', // bright white
}

const BG: Record<number, string> = {
  40: '#111827', 41: '#450a0a', 42: '#052e16', 43: '#422006',
  44: '#172554', 45: '#3b0764', 46: '#083344', 47: '#1e293b',
}

interface State {
  fg: string | null
  bg: string | null
  bold: boolean
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function stateToStyle(s: State): string {
  const parts: string[] = []
  if (s.fg) parts.push(`color:${s.fg}`)
  if (s.bg) parts.push(`background:${s.bg}`)
  if (s.bold) parts.push('font-weight:600')
  return parts.join(';')
}

export function ansiToHtml(line: string): string {
  // Tokenise: split on SGR sequences (\x1B[...m)
  const tokens = line.split(/(\x1B\[[0-9;]*m)/)
  let html = ''
  let spanOpen = false
  let state: State = { fg: null, bg: null, bold: false }

  const closeSpan = () => { if (spanOpen) { html += '</span>'; spanOpen = false } }
  const openSpan = () => {
    const style = stateToStyle(state)
    if (style) { html += `<span style="${style}">`; spanOpen = true }
  }

  for (const token of tokens) {
    const m = token.match(/^\x1B\[([0-9;]*)m$/)
    if (m) {
      closeSpan()
      const codes = m[1] === '' ? [0] : m[1].split(';').map(Number)
      for (const code of codes) {
        if (code === 0)  { state = { fg: null, bg: null, bold: false } }
        else if (code === 1)  { state.bold = true }
        else if (code === 22) { state.bold = false }
        else if (code === 39) { state.fg = null }
        else if (code === 49) { state.bg = null }
        else if (FG[code])   { state.fg = FG[code] }
        else if (BG[code])   { state.bg = BG[code] }
        // codes 38/48 (256-color / truecolor) – skip gracefully
      }
      openSpan()
    } else if (token) {
      html += escHtml(token)
    }
  }

  closeSpan()
  return html
}

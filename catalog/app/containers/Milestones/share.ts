import * as dateFns from 'date-fns'

import wordmark from 'components/Logo/quilt-wordmark.png'

import type { Badge } from './badges'

const MIDNIGHT = '#19163b'
const INK_SECONDARY = 'rgba(0, 0, 0, 0.54)'
const DIVIDER = 'rgba(0, 0, 0, 0.12)'

export const earnedOn = (at: Date | null) =>
  at ? dateFns.format(at, 'MMM d, yyyy') : null

/** Where a shared badge lands: the milestones page, scrolled to it. */
export const badgeUrl = (origin: string, b: Badge) => `${origin}/milestones#${b.id}`

export function shareText(host: string, b: Badge) {
  const on = b.state.kind === 'earned' ? earnedOn(b.state.at) : null
  return `${host} reached a Quilt milestone: ${b.title}. ${b.description}${on ? ` Earned ${on}.` : ''}`
}

// Microsoft's documented "Share to Teams" web entry point.
export const teamsShareUrl = (url: string, text: string) =>
  `https://teams.microsoft.com/share?${new URLSearchParams({ href: url, msgText: text, preview: 'true' })}`

// Slack has no share-by-URL entry point: the message is copied for pasting, and
// a bare URL on its own line is what Slack unfurls.
export const slackMessage = (url: string, text: string) => `:trophy: ${text}\n${url}`

const W = 1200
const H = 630
const TEXT_X = 430
const TEXT_W = W - TEXT_X - 70
const BAND = 96
const FONT = 'Roboto, Helvetica, Arial, sans-serif'

/** Greedy word wrap; the last line ends in an ellipsis if text is left over. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxLines: number,
  maxW = TEXT_W,
): string[] {
  const lines: string[] = []
  let line = ''
  const words = text.split(' ')
  for (let i = 0; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next
    } else if (lines.length === maxLines - 1) {
      let cut = line
      while (cut && ctx.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1)
      return [...lines, `${cut.trimEnd()}…`]
    } else {
      lines.push(line)
      line = words[i]
    }
  }
  return [...lines, line]
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Logo failed to load'))
    img.src = src
  })

/** A 1200×630 card (the size chat apps preview) of one earned badge. */
export async function renderBadgeImage(host: string, b: Badge): Promise<Blob> {
  // `fonts.ready` resolves without loading a face nothing on the page has used
  // yet; without these the card can draw the icon's ligature name as text.
  const [logo] = await Promise.all([
    loadImage(wordmark),
    document.fonts?.load(`150px "Material Icons"`, b.icon),
    document.fonts?.load(`500 64px Roboto`),
    document.fonts?.load(`400 30px Roboto`),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = DIVIDER
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, W - 2, H - 2)
  // The wordmark is drawn for the midnight rail; it gets that ground here too.
  ctx.fillStyle = MIDNIGHT
  ctx.fillRect(0, H - BAND, W, BAND)

  // Medallion: the same mark the catalog draws, at card scale.
  const cx = 230
  const cy = (H - BAND) / 2
  ctx.fillStyle = MIDNIGHT
  ctx.beginPath()
  ctx.arc(cx, cy, 130, 0, 2 * Math.PI)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = '150px "Material Icons"'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(b.icon, cx, cy)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `500 64px ${FONT}`
  let titleSize = 64
  let title = wrap(ctx, b.title, 2)
  if (title.length > 1) {
    titleSize = 54
    ctx.font = `500 ${titleSize}px ${FONT}`
    title = wrap(ctx, b.title, 2)
  }
  const titleLead = titleSize * 1.15
  ctx.font = `400 30px ${FONT}`
  let desc = wrap(ctx, b.description, 2)
  // Balance two lines rather than leave a one-word widow.
  if (desc.length === 2) {
    desc = wrap(
      ctx,
      b.description,
      2,
      Math.ceil(ctx.measureText(b.description).width / 2) + 40,
    )
  }
  const descLead = 42
  const on = b.state.kind === 'earned' ? earnedOn(b.state.at) : null
  const meta = [host, b.category, on && `Earned ${on}`].filter(Boolean).join(' · ')

  // Title, description and readout as one block, centred on the medallion.
  const blockH = title.length * titleLead + 20 + desc.length * descLead + 24 + 30
  let y = cy - blockH / 2 + titleSize
  ctx.fillStyle = MIDNIGHT
  ctx.font = `500 ${titleSize}px ${FONT}`
  title.forEach((l) => {
    ctx.fillText(l, TEXT_X, y)
    y += titleLead
  })
  y += 20 - titleLead + descLead
  ctx.fillStyle = 'rgba(0, 0, 0, 0.87)'
  ctx.font = `400 30px ${FONT}`
  desc.forEach((l) => {
    ctx.fillText(l, TEXT_X, y)
    y += descLead
  })
  y += 24
  ctx.fillStyle = INK_SECONDARY
  ctx.font = `400 26px ${FONT}`
  ctx.fillText(meta, TEXT_X, y, TEXT_W)

  const logoH = 40
  const logoW = (logo.width / logo.height) * logoH
  ctx.drawImage(logo, TEXT_X, H - BAND / 2 - logoH / 2, logoW, logoH)

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
      'image/png',
    ),
  )
}

/**
 * Starts the clipboard write inside the click that asked for it: Safari drops
 * the permission at the first `await`, so the image goes in as a pending blob.
 * Rejects where images can't go on the clipboard (e.g. Firefox).
 */
export function copyImage(blob: Promise<Blob>): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return Promise.reject(new Error('Image clipboard unsupported'))
  }
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export function downloadImage(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Safari cancels the download if the URL is revoked in the same task.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

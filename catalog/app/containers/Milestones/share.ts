import * as dateFns from 'date-fns'

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

/** A 1200×630 card (the size chat apps preview) of one earned badge. */
export async function renderBadgeImage(host: string, b: Badge): Promise<Blob> {
  await document.fonts?.ready
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

  // Medallion: the same mark the catalog draws, at card scale.
  const cx = 230
  const cy = H / 2
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
  const x = 430
  ctx.fillStyle = INK_SECONDARY
  ctx.font = '500 28px Roboto, Helvetica, Arial, sans-serif'
  ctx.fillText(`MILESTONE · ${b.category.toUpperCase()}`, x, 210)
  ctx.fillStyle = MIDNIGHT
  ctx.font = '500 68px Roboto, Helvetica, Arial, sans-serif'
  ctx.fillText(b.title, x, 300, W - x - 60)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.87)'
  ctx.font = '400 32px Roboto, Helvetica, Arial, sans-serif'
  ctx.fillText(b.description, x, 360, W - x - 60)
  const on = b.state.kind === 'earned' ? earnedOn(b.state.at) : null
  ctx.fillStyle = INK_SECONDARY
  ctx.font = '400 28px Roboto, Helvetica, Arial, sans-serif'
  ctx.fillText(
    [host, on && `Earned ${on}`].filter(Boolean).join(' · '),
    x,
    430,
    W - x - 60,
  )
  ctx.fillText('Quilt', x, H - 60)

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
  URL.revokeObjectURL(url)
}

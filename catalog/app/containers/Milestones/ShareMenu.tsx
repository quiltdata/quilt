import * as React from 'react'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'

import type { Badge } from './badges'
import * as Share from './share'

interface ShareMenuProps {
  badge: Badge
  anchorEl: HTMLElement | null
  onClose: () => void
}

export default function ShareMenu({ badge, anchorEl, onClose }: ShareMenuProps) {
  const { push } = Notifications.use()
  const { host, origin } = window.location
  const url = Share.badgeUrl(origin, badge)
  const text = Share.shareText(host, badge)

  const teams = React.useCallback(() => {
    window.open(
      Share.teamsShareUrl(url, text),
      '_blank',
      'noopener,noreferrer,width=700,height=600',
    )
    onClose()
  }, [url, text, onClose])

  const slack = React.useCallback(() => {
    onClose()
    // A textarea copy loses its selection to the open Menu's focus trap.
    navigator.clipboard.writeText(Share.slackMessage(url, text)).then(
      () => push('Copied. Paste it into a Slack message.'),
      () => push("Couldn't copy the message."),
    )
  }, [url, text, push, onClose])

  const image = React.useCallback(() => {
    onClose()
    const blob = Share.renderBadgeImage(host, badge)
    Share.copyImage(blob).then(
      () => push('Badge image copied. Paste it into Slack or Teams.'),
      () =>
        blob.then(
          (b) => {
            Share.downloadImage(b, `quilt-milestone-${badge.id}.png`)
            push('Badge image downloaded.')
          },
          (e) =>
            push(`Couldn't make the badge image: ${e instanceof Error ? e.message : e}`),
        ),
    )
  }, [host, badge, push, onClose])

  return (
    <M.Menu anchorEl={anchorEl} open={!!anchorEl} onClose={onClose}>
      <M.MenuItem onClick={teams}>
        <M.ListItemIcon>
          <M.Icon fontSize="small">open_in_new</M.Icon>
        </M.ListItemIcon>
        <M.ListItemText primary="Share to Microsoft Teams" />
      </M.MenuItem>
      <M.MenuItem onClick={slack}>
        <M.ListItemIcon>
          <M.Icon fontSize="small">content_copy</M.Icon>
        </M.ListItemIcon>
        <M.ListItemText primary="Copy for Slack" />
      </M.MenuItem>
      <M.MenuItem onClick={image}>
        <M.ListItemIcon>
          <M.Icon fontSize="small">image</M.Icon>
        </M.ListItemIcon>
        <M.ListItemText primary="Copy badge image" />
      </M.MenuItem>
    </M.Menu>
  )
}

/** One share button wired to its menu. */
export function ShareButton({ badge, className }: { badge: Badge; className?: string }) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const close = React.useCallback(() => setAnchorEl(null), [])
  return (
    <>
      <M.IconButton
        aria-label={`Share “${badge.title}”`}
        className={className}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        size="small"
      >
        <M.Icon fontSize="small">share</M.Icon>
      </M.IconButton>
      <ShareMenu badge={badge} anchorEl={anchorEl} onClose={close} />
    </>
  )
}

import * as React from 'react'
import * as M from '@material-ui/core'

import * as HubSpot from 'components/HubSpot'

// The header mirrors Qurator's (Chat.tsx) so the two read as one panel with
// two faces: same row height, mark, type and close button.
const useStyles = M.makeStyles((t) => ({
  help: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    background: t.palette.background.paper,
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexShrink: 0,
    gap: t.spacing(1),
    minHeight: 56,
    padding: t.spacing(1, 1, 1, 2),
  },
  mark: {
    alignItems: 'center',
    border: `1px solid ${t.palette.primary.main}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.primary.main,
    display: 'grid',
    flexShrink: 0,
    height: t.spacing(4),
    placeItems: 'center',
    width: t.spacing(4),
  },
  glyph: {
    fontSize: t.typography.body1.fontSize,
  },
  title: {
    fontSize: t.typography.body1.fontSize,
    margin: 0,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: 1.3,
  },
  subtitle: {
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
    lineHeight: 1.3,
  },
  close: {
    color: t.palette.text.secondary,
    marginLeft: 'auto',
    '&&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  blocked: {
    color: t.palette.text.secondary,
    padding: t.spacing(3),
  },
  embed: {
    background: t.palette.background.paper,
    flexGrow: 1,
    position: 'relative',
    // HubSpot injects its iframe at 300x150; fill the panel instead.
    '& iframe': {
      border: 0,
      height: '100%',
      left: 0,
      position: 'absolute',
      top: 0,
      width: '100%',
    },
  },
}))

const BLOCKED_AFTER_MS = 15_000

interface HelpProps {
  onClose: () => void
}

export default function Help({ onClose }: HelpProps) {
  const classes = useStyles()
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const embedRef = React.useRef<HTMLDivElement>(null)
  const [blocked, setBlocked] = React.useState(false)
  HubSpot.useEmbed()
  // A blocked loader (ad-blockers) or no chatflow for the page leaves the panel
  // empty forever; a slow load clears the notice when the iframe arrives.
  React.useEffect(() => {
    const el = embedRef.current
    if (!el) return
    const hasChat = () => !!el.querySelector('iframe')
    const timer = setTimeout(() => setBlocked(!hasChat()), BLOCKED_AFTER_MS)
    const observer = new MutationObserver(() => hasChat() && setBlocked(false))
    observer.observe(el, { childList: true, subtree: true })
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])
  // The chat itself is a cross-origin iframe that may take seconds to arrive;
  // land focus on the panel's own control so keyboard users are not left behind.
  React.useEffect(() => {
    closeRef.current?.focus()
  }, [])
  return (
    <div className={classes.help}>
      <div className={classes.header}>
        <span className={classes.mark}>
          <M.Icon className={classes.glyph}>support_agent</M.Icon>
        </span>
        <div>
          <h2 className={classes.title}>Help</h2>
          <div className={classes.subtitle}>Chat with Quilt support and sales</div>
        </div>
        <M.IconButton
          ref={closeRef}
          className={classes.close}
          onClick={onClose}
          size="small"
          aria-label="Close Help"
        >
          <M.Icon>close</M.Icon>
        </M.IconButton>
      </div>
      <div role="status">
        {blocked && (
          <M.Typography variant="body2" className={classes.blocked}>
            Chat isn't available right now. Email{' '}
            <a href="mailto:support@quilt.bio">support@quilt.bio</a> instead.
          </M.Typography>
        )}
      </div>
      <div ref={embedRef} id={HubSpot.EMBED_ID} className={classes.embed} />
    </div>
  )
}

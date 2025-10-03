/**
 * Right Sidebar Component
 *
 * Vertical icon bar on the right edge of the screen (Cursor-style)
 * Replaces the floating FAB button with a more integrated design.
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import {
  QuestionAnswer as AssistantIcon,
  Code as DeveloperIcon,
} from '@material-ui/icons'

const useStyles = M.makeStyles((t) => ({
  sidebar: {
    position: 'fixed',
    right: 0,
    top: 0,
    height: '100vh',
    width: '48px',
    background: 'rgba(40, 43, 80, 0.95)', // Match app's primary color with transparency
    backdropFilter: 'blur(10px)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: t.spacing(2),
    paddingBottom: t.spacing(2),
    gap: t.spacing(1),
    zIndex: 1300,
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
  },
  iconButton: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    padding: 0,
    transition: 'all 0.2s ease-in-out',
    color: 'rgba(255, 255, 255, 0.7)',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.1)',
      color: 'rgba(255, 255, 255, 0.9)',
      transform: 'scale(1.05)',
    },
  },
  activeIcon: {
    background: 'rgba(255, 165, 0, 0.2)', // Orange tint for active state
    color: M.colors.orange[400],
    '&:hover': {
      background: 'rgba(255, 165, 0, 0.3)',
      color: M.colors.orange[300],
    },
  },
  badge: {
    '& .MuiBadge-badge': {
      background: M.colors.orange[500],
      color: M.colors.orange[500],
      boxShadow: '0 0 0 2px rgba(40, 43, 80, 0.95)',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      minWidth: '10px',
      padding: 0,
    },
  },
}))

interface RightSidebarProps {
  onQurator: () => void
  quratorActive: boolean
  contextUsagePercent?: number
}

export default function RightSidebar({
  onQurator,
  quratorActive,
  contextUsagePercent,
}: RightSidebarProps) {
  const classes = useStyles()

  const getContextColor = (percent?: number) => {
    if (!percent) return undefined
    if (percent > 95) return '#ff5252' // bright red for visibility
    if (percent > 80) return '#ffa726' // bright orange
    return '#66bb6a' // bright green
  }

  return (
    <div className={classes.sidebar}>
      <M.Tooltip title="Qurator AI Assistant" placement="left" arrow>
        <M.Badge
          variant="dot"
          invisible={!quratorActive}
          classes={{ root: classes.badge }}
          overlap="rectangle"
        >
          <M.IconButton
            onClick={onQurator}
            className={`${classes.iconButton} ${quratorActive ? classes.activeIcon : ''}`}
            aria-label="Open Qurator"
          >
            <AssistantIcon />
          </M.IconButton>
        </M.Badge>
      </M.Tooltip>

      {/* Context usage indicator */}
      {contextUsagePercent !== undefined && contextUsagePercent > 0 && (
        <M.Tooltip
          title={`Context: ${contextUsagePercent.toFixed(1)}%`}
          placement="left"
          arrow
        >
          <div style={{ marginTop: '8px' }}>
            <M.CircularProgress
              variant="determinate"
              value={Math.min(contextUsagePercent, 100)}
              size={24}
              thickness={6}
              style={{ color: getContextColor(contextUsagePercent) }}
            />
          </div>
        </M.Tooltip>
      )}

      {/* Spacer */}
      <div style={{ flexGrow: 1 }} />

      {/* Developer tools icon at bottom
      <M.Tooltip title="Developer Tools" placement="left" arrow>
        <M.IconButton
          className={classes.iconButton}
          aria-label="Developer Tools"
        >
          <DeveloperIcon fontSize="small" />
        </M.IconButton>
      </M.Tooltip>
      */}
    </div>
  )
}

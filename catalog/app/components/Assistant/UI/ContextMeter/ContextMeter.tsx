/**
 * Context Meter Component
 *
 * Displays current context window usage with visual feedback,
 * similar to Cursor's context indicator.
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import cx from 'classnames'

import type { CumulativeUsage } from '../../Utils/TokenCounter'
import { formatTokenCount, getWarningLevel } from '../../Utils/TokenCounter'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
    padding: `${t.spacing(0.5)}px ${t.spacing(1)}px`,
    borderRadius: t.spacing(1),
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(107, 79, 207, 0.2)',
    fontSize: '0.75rem',
    fontWeight: 500,
    transition: 'all 0.2s ease-in-out',
    cursor: 'pointer',
    userSelect: 'none',
    color: '#2d2753',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.98)',
      borderColor: 'rgba(107, 79, 207, 0.3)',
    },
  },
  safe: {
    color: '#2d2753',
  },
  warning: {
    color: '#f57c00',
    borderColor: '#f57c00',
  },
  critical: {
    color: '#d32f2f',
    borderColor: '#d32f2f',
    animation: '$pulse 2s ease-in-out infinite',
  },
  '@keyframes pulse': {
    '0%, 100%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.7,
    },
  },
  circularProgress: {
    transition: 'all 0.3s ease-in-out',
  },
  tooltip: {
    fontSize: '0.875rem',
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(107, 79, 207, 0.2)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(48, 31, 116, 0.16)',
    color: '#2d2753',
    maxWidth: 320,
  },
  tooltipContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
    padding: t.spacing(1),
  },
  tooltipRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: t.spacing(2),
    alignItems: 'center',
  },
  tooltipLabel: {
    color: 'rgba(45, 39, 83, 0.7)',
    fontSize: '0.8rem',
  },
  tooltipValue: {
    fontWeight: 600,
    color: '#2d2753',
    fontSize: '0.8rem',
  },
  percentage: {
    minWidth: '40px',
    textAlign: 'right',
    fontWeight: 600,
  },
  warningMessage: {
    padding: t.spacing(1),
    borderRadius: 8,
    background: 'rgba(255, 193, 7, 0.1)',
    border: '1px solid rgba(255, 193, 7, 0.3)',
    color: '#f57c00',
    fontSize: '0.8rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(0.5),
  },
  criticalMessage: {
    padding: t.spacing(1),
    borderRadius: 8,
    background: 'rgba(211, 47, 47, 0.1)',
    border: '1px solid rgba(211, 47, 47, 0.3)',
    color: '#d32f2f',
    fontSize: '0.8rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(0.5),
  },
}))

interface ContextMeterProps {
  usage: CumulativeUsage
  className?: string
  modelId?: string
}

export default function ContextMeter({ usage, className }: ContextMeterProps) {
  const classes = useStyles()
  const warningLevel = getWarningLevel(usage.percentUsed)

  const circleColor = React.useMemo(() => {
    switch (warningLevel) {
      case 'critical':
        return '#ff5252' // bright red for visibility
      case 'warning':
        return '#ffa726' // bright orange
      default:
        return '#66bb6a' // bright green
    }
  }, [warningLevel])

  // const isOverLimit = usage.percentUsed > 100
  // const effectivePercent = Math.min(usage.percentUsed, 100)
  // const overageTokens = Math.max(0, usage.totalTokens - usage.contextLimit)

  const tooltipContent = (
    <div className={classes.tooltipContent}>
      <div className={classes.tooltipRow}>
        <span className={classes.tooltipLabel}>Model:</span>
        <span className={classes.tooltipValue}>Unknown</span>
      </div>
      <div className={classes.tooltipRow}>
        <span className={classes.tooltipLabel}>Context limit:</span>
        <span className={classes.tooltipValue}>
          {formatTokenCount(usage.contextLimit)}
        </span>
      </div>
      <M.Divider style={{ margin: '8px 0' }} />
      <div className={classes.tooltipRow}>
        <span className={classes.tooltipLabel}>Used:</span>
        <span className={classes.tooltipValue}>
          {usage.totalTokens.toLocaleString()} ({usage.percentUsed.toFixed(1)}%)
        </span>
      </div>
      <div className={classes.tooltipRow}>
        <span className={classes.tooltipLabel}>Input:</span>
        <span className={classes.tooltipValue}>{usage.inputTokens.toLocaleString()}</span>
      </div>
      <div className={classes.tooltipRow}>
        <span className={classes.tooltipLabel}>Output:</span>
        <span className={classes.tooltipValue}>
          {usage.outputTokens.toLocaleString()}
        </span>
      </div>
      {usage.isCritical && (
        <>
          <M.Divider style={{ margin: '8px 0' }} />
          <div className={classes.criticalMessage}>
            <M.Icon style={{ fontSize: 16 }}>warning</M.Icon>
            <span>Context nearly full! Consider starting a new conversation.</span>
          </div>
        </>
      )}
      {!usage.isCritical && usage.isNearLimit && (
        <>
          <M.Divider style={{ margin: '8px 0' }} />
          <div className={classes.warningMessage}>
            <M.Icon style={{ fontSize: 16 }}>info</M.Icon>
            <span>
              Approaching context limit. {formatTokenCount(usage.tokensRemaining)}{' '}
              remaining.
            </span>
          </div>
        </>
      )}
      {!usage.isCritical && !usage.isNearLimit && (
        <>
          <M.Divider style={{ margin: '8px 0' }} />
          <div className={classes.tooltipRow}>
            <span className={classes.tooltipLabel}>Remaining:</span>
            <span className={classes.tooltipValue}>
              {formatTokenCount(usage.tokensRemaining)}
            </span>
          </div>
        </>
      )}
    </div>
  )

  return (
    <M.Tooltip
      title={tooltipContent}
      classes={{ tooltip: classes.tooltip }}
      placement="bottom"
      arrow
    >
      <div
        className={cx(classes.root, classes[warningLevel], className)}
        role="status"
        aria-label={`Context usage: ${usage.percentUsed.toFixed(1)}%`}
      >
        <M.CircularProgress
          variant="determinate"
          value={Math.min(usage.percentUsed, 100)}
          size={16}
          thickness={6}
          className={classes.circularProgress}
          style={{ color: circleColor }}
        />
        <span className={classes.percentage}>{usage.percentUsed.toFixed(1)}%</span>
      </div>
    </M.Tooltip>
  )
}

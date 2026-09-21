import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from '../../Model'

// The sticky instructions strip that sits between the conversation history
// and the composer: standing guidance ("answer in French", "always cite
// package revisions") that rides along with every message. The strip is a
// working surface, not chrome — Surface white over the sidebar ground,
// delineated by a hairline, collapsible so it costs one caption row when
// the user is done configuring it.
//
// Qurator's amber identity marks the *state*, per the Indicator Rule: when
// instructions are active the collapsed row wears an outlined amber
// "Instructions on" chip — a stroke, never a fill. Muting (the switch)
// keeps the text but stops the injection, so a user can park instructions
// without retyping them; Clear erases the text itself.
const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    borderTop: `1px solid ${t.palette.divider}`,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    padding: t.spacing(1, 2),
    textAlign: 'left',
    width: '100%',
  },
  headerIcon: {
    color: t.palette.text.secondary,
    fontSize: t.typography.body1.fontSize,
  },
  headerLabel: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightMedium,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
  },
  chipOn: {
    borderColor: t.palette.secondary.main,
    color: t.palette.secondary.main,
    marginLeft: t.spacing(0.5),
  },
  chipMuted: {
    marginLeft: t.spacing(0.5),
  },
  expandIcon: {
    color: t.palette.text.secondary,
    marginLeft: 'auto',
    transition: t.transitions.create('transform', {
      duration: t.transitions.duration.shorter,
    }),
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
    padding: t.spacing(0, 2, 1.5),
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  switchLabel: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
  },
  clear: {
    marginLeft: 'auto',
  },
  hint: {
    ...t.typography.caption,
    color: t.palette.text.hint,
  },
}))

const PLACEHOLDER =
  'e.g. Prefer concise answers. Always cite package names and revisions.'

interface InstructionsProps {
  className?: string
  instructions: Model.UserInstructions.UserInstructions
}

export default function Instructions({ className, instructions }: InstructionsProps) {
  const classes = useStyles()
  const { text, setText, enabled, setEnabled, clear, active } = instructions

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((prev) => !prev), [])

  const muted = !enabled && !!text.trim()

  return (
    <div className={cx(classes.root, className)}>
      <M.ButtonBase
        className={classes.header}
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} Qurator instructions`}
      >
        <M.Icon className={classes.headerIcon}>tune</M.Icon>
        <span className={classes.headerLabel}>Instructions</span>
        {active && (
          <M.Chip
            className={classes.chipOn}
            label="Instructions on"
            size="small"
            variant="outlined"
          />
        )}
        {muted && (
          <M.Chip
            className={classes.chipMuted}
            label="Muted"
            size="small"
            variant="outlined"
          />
        )}
        <M.Icon
          className={cx(classes.expandIcon, expanded && classes.expandIconOpen)}
          fontSize="small"
        >
          expand_more
        </M.Icon>
      </M.ButtonBase>
      <M.Collapse in={expanded}>
        <div className={classes.body}>
          <M.TextField
            fullWidth
            multiline
            rows={3}
            rowsMax={8}
            variant="outlined"
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputProps={{ 'aria-label': 'Qurator instructions' }}
          />
          <div className={classes.controls}>
            <M.FormControlLabel
              classes={{ label: classes.switchLabel }}
              control={
                <M.Switch
                  checked={enabled}
                  color="secondary"
                  onChange={(e) => setEnabled(e.target.checked)}
                  size="small"
                />
              }
              label="Apply to every message"
            />
            <M.Button
              className={classes.clear}
              disabled={!text}
              onClick={clear}
              size="small"
            >
              Clear
            </M.Button>
          </div>
          <span className={classes.hint}>
            Sent with every message as part of the prompt. Stored in this browser only.
          </span>
        </div>
      </M.Collapse>
    </div>
  )
}

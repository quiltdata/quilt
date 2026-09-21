import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as CatalogSettings from 'utils/CatalogSettings'

import type * as Model from '../../Model'

// The sticky instructions strip that sits between the conversation history
// and the composer: standing guidance ("answer in French", "always cite
// package revisions") that rides along with every message for everyone on
// the stack. The strip is a working surface, not chrome — Surface white over
// the sidebar ground, delineated by a hairline, collapsible so it costs one
// caption row when nobody is configuring it.
//
// Qurator's amber identity marks the *state*, per the Indicator Rule: when
// instructions are active the collapsed row wears an outlined amber
// "Instructions on" chip — a stroke, never a fill. Muting (the switch)
// keeps the text but stops the injection, so an admin can park instructions
// without retyping them; Clear erases the text itself. Non-admins get the
// same readout but no controls: the text is theirs to see, not to change.
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
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  headerIcon: {
    color: t.palette.text.secondary,
    fontSize: t.typography.body1.fontSize,
  },
  headerLabel: {
    ...t.typography.overline,
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: 1,
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
  readOnly: {
    ...t.typography.body2,
    color: t.palette.text.primary,
    whiteSpace: 'pre-wrap',
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
  actions: {
    display: 'flex',
    gap: t.spacing(1),
    marginLeft: 'auto',
  },
  hint: {
    ...t.typography.caption,
    color: t.palette.text.hint,
  },
  error: {
    ...t.typography.caption,
    color: t.palette.error.main,
  },
}))

const PLACEHOLDER =
  'e.g. Prefer concise answers. Always cite package names and revisions.'

const HINT_ADMIN =
  'Applies to everyone on this stack, sent with every message as part of the prompt.'
const HINT_READ_ONLY = 'Set by an admin for everyone on this stack.'
const EMPTY_READ_ONLY = 'No instructions set for this stack.'

const errorMessage = (e: unknown) =>
  e instanceof CatalogSettings.SettingsConflictError
    ? e.message
    : "Couldn't save instructions, see console for details"

interface InstructionsProps {
  className?: string
  instructions: Model.UserInstructions.UserInstructions
}

export default function Instructions({ className, instructions }: InstructionsProps) {
  const classes = useStyles()
  const { text, setText, enabled, setEnabled, clear, active, canEdit } = instructions

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((prev) => !prev), [])

  // Local draft so typing does not PUT settings.json per keystroke; Save
  // commits, and a stale draft is dropped when the stack value moves.
  const [draft, setDraft] = React.useState(text)
  React.useEffect(() => setDraft(text), [text])
  const dirty = draft !== text

  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const run = React.useCallback(async (op: () => Promise<void>) => {
    setPending(true)
    setError(null)
    try {
      await op()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error saving Qurator instructions', e)
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }, [])

  const save = React.useCallback(() => run(() => setText(draft)), [run, setText, draft])
  const toggle = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.checked
      run(() => setEnabled(next))
    },
    [run, setEnabled],
  )
  const onClear = React.useCallback(() => run(clear), [run, clear])

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
          {canEdit ? (
            <>
              <M.TextField
                fullWidth
                multiline
                rows={3}
                rowsMax={8}
                variant="outlined"
                placeholder={PLACEHOLDER}
                value={draft}
                disabled={pending}
                onChange={(e) => setDraft(e.target.value)}
                inputProps={{ 'aria-label': 'Qurator instructions' }}
              />
              <div className={classes.controls}>
                <M.FormControlLabel
                  classes={{ label: classes.switchLabel }}
                  control={
                    <M.Switch
                      checked={enabled}
                      color="primary"
                      disabled={pending}
                      onChange={toggle}
                      size="small"
                    />
                  }
                  label="Apply to every message"
                />
                <div className={classes.actions}>
                  <M.Button disabled={!text || pending} onClick={onClear} size="small">
                    Clear
                  </M.Button>
                  <M.Button
                    color="primary"
                    disabled={!dirty || pending}
                    onClick={save}
                    size="small"
                    variant="outlined"
                  >
                    Save
                  </M.Button>
                </div>
              </div>
              {error ? (
                <span className={classes.error} role="alert">
                  {error}
                </span>
              ) : (
                <span className={classes.hint}>{HINT_ADMIN}</span>
              )}
            </>
          ) : (
            <>
              <div className={classes.readOnly}>{text.trim() || EMPTY_READ_ONLY}</div>
              <span className={classes.hint}>{HINT_READ_ONLY}</span>
            </>
          )}
        </div>
      </M.Collapse>
    </div>
  )
}

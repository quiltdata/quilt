import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as UserInstructions from '../../Model/UserInstructions'

// The sticky instructions strip that sits between the conversation history
// and the composer: standing guidance ("answer in French", "always cite
// package revisions") that rides along with every message. Two independent
// layers, global first: the stack's steer set by an admin for everyone, then
// the user's own notes for their own work, kept in this browser. Either can
// be on without the other, and clearing one never touches the other.
//
// The strip is a working surface, not chrome — Surface white over the sidebar
// ground, delineated by a hairline, collapsible so it costs one caption row
// when nobody is configuring it.
//
// Qurator's amber identity marks the *state*, per the Indicator Rule: each
// active layer wears its own outlined amber chip on the collapsed row — a
// stroke, never a fill. Muting (the switch) keeps the text but stops the
// injection, so instructions can be parked without retyping them; Clear
// erases the text itself. Non-admins get the global text as a readout with no
// controls: it is theirs to see, not to change. Their own notes are always
// theirs to edit.
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
  chips: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(0.5),
  },
  chipOn: {
    borderColor: t.palette.secondary.main,
    color: t.palette.secondary.main,
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
    gap: t.spacing(2),
    padding: t.spacing(0, 2, 1.5),
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
  },
  // The two layers are peers, so each is headed rather than nested: a
  // caption-weight label carries the scope ("Global" / "Personal") that the
  // hint then spells out.
  sectionLabel: {
    ...t.typography.overline,
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: 1,
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

const GLOBAL_PLACEHOLDER =
  'e.g. Prefer concise answers. Always cite package names and revisions.'
const PERSONAL_PLACEHOLDER =
  'e.g. I work on the RNA-seq buckets. Default to Parquet over CSV.'

const HINT_GLOBAL_ADMIN =
  'Applies to everyone on this stack, sent with every message as part of the prompt.'
const HINT_GLOBAL_READ_ONLY = 'Set by an admin for everyone on this stack.'
const EMPTY_GLOBAL_READ_ONLY = 'No global instructions set for this stack.'
const HINT_PERSONAL =
  'Yours alone, kept in this browser. Sent with every message alongside any global instructions.'

interface SectionProps {
  label: string
  /** Names the textarea, so the two editors stay distinguishable. */
  fieldLabel: string
  placeholder: string
  hint: string
  emptyReadOnly: string
  readOnlyHint: string
  instructions: UserInstructions.Instructions
}

function Section({
  label,
  fieldLabel,
  placeholder,
  hint,
  emptyReadOnly,
  readOnlyHint,
  instructions,
}: SectionProps) {
  const classes = useStyles()
  const { text, enabled, canEdit } = instructions
  const { draft, setDraft, dirty, pending, error, save, toggle, onClear } =
    UserInstructions.useInstructionsEditor(instructions)

  return (
    <div className={classes.section}>
      <span className={classes.sectionLabel}>{label}</span>
      {canEdit ? (
        <>
          <M.TextField
            fullWidth
            multiline
            rows={3}
            rowsMax={8}
            variant="outlined"
            placeholder={placeholder}
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            inputProps={{ 'aria-label': fieldLabel }}
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
              <M.Button
                disabled={!(draft || text) || pending}
                onClick={onClear}
                size="small"
              >
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
            <span className={classes.hint}>{hint}</span>
          )}
        </>
      ) : (
        <>
          <div className={classes.readOnly}>{text.trim() || emptyReadOnly}</div>
          <span className={classes.hint}>{readOnlyHint}</span>
        </>
      )}
    </div>
  )
}

interface InstructionsProps {
  className?: string
  instructions: UserInstructions.DualInstructions
}

export default function Instructions({ className, instructions }: InstructionsProps) {
  const classes = useStyles()
  const { global, personal } = instructions

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((prev) => !prev), [])

  const globalMuted = !global.enabled && !!global.text.trim()
  const personalMuted = !personal.enabled && !!personal.text.trim()

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
        <span className={classes.chips}>
          {global.active && (
            <M.Chip
              className={classes.chipOn}
              label="Global on"
              size="small"
              variant="outlined"
            />
          )}
          {personal.active && (
            <M.Chip
              className={classes.chipOn}
              label="Personal on"
              size="small"
              variant="outlined"
            />
          )}
          {globalMuted && <M.Chip label="Global muted" size="small" variant="outlined" />}
          {personalMuted && (
            <M.Chip label="Personal muted" size="small" variant="outlined" />
          )}
        </span>
        <M.Icon
          className={cx(classes.expandIcon, expanded && classes.expandIconOpen)}
          fontSize="small"
        >
          expand_more
        </M.Icon>
      </M.ButtonBase>
      <M.Collapse in={expanded}>
        <div className={classes.body}>
          <Section
            label="Global — this stack"
            fieldLabel="Global Qurator instructions"
            placeholder={GLOBAL_PLACEHOLDER}
            hint={HINT_GLOBAL_ADMIN}
            emptyReadOnly={EMPTY_GLOBAL_READ_ONLY}
            readOnlyHint={HINT_GLOBAL_READ_ONLY}
            instructions={global}
          />
          <Section
            label="Personal — my notes"
            fieldLabel="Personal Qurator notes"
            placeholder={PERSONAL_PLACEHOLDER}
            hint={HINT_PERSONAL}
            // Personal notes are always editable, so these never render.
            emptyReadOnly=""
            readOnlyHint=""
            instructions={personal}
          />
        </div>
      </M.Collapse>
    </div>
  )
}

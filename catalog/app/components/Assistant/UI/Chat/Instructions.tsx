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
  // Headerless, so the body needs its own top inset.
  panelBody: {
    paddingTop: t.spacing(1.5),
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

type Editor = ReturnType<typeof UserInstructions.useInstructionsEditor>

/** A Section that owns its draft, for hosts that keep every layer on screen. */
function OwnSection(props: SectionProps) {
  const editor = UserInstructions.useInstructionsEditor(props.instructions)
  return <Section {...props} editor={editor} />
}

function Section({
  label,
  fieldLabel,
  placeholder,
  hint,
  emptyReadOnly,
  readOnlyHint,
  instructions,
  editor,
}: SectionProps & { editor: Editor }) {
  const classes = useStyles()
  const { text, enabled, canEdit } = instructions
  const { draft, setDraft, dirty, pending, error, save, toggle, onClear } = editor

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

export type Layer = 'global' | 'personal'

const LAYERS: Record<
  Layer,
  { icon: string; name: string } & Omit<SectionProps, 'instructions'>
> = {
  global: {
    icon: 'public',
    name: 'Global instructions',
    label: 'Global — this stack',
    fieldLabel: 'Global Qurator instructions',
    placeholder: GLOBAL_PLACEHOLDER,
    hint: HINT_GLOBAL_ADMIN,
    emptyReadOnly: EMPTY_GLOBAL_READ_ONLY,
    readOnlyHint: HINT_GLOBAL_READ_ONLY,
  },
  personal: {
    icon: 'person',
    name: 'Personal notes',
    label: 'Personal — my notes',
    fieldLabel: 'Personal Qurator notes',
    placeholder: PERSONAL_PLACEHOLDER,
    hint: HINT_PERSONAL,
    // Personal notes are always editable, so these never render.
    emptyReadOnly: '',
    readOnlyHint: '',
  },
}

type LayerState = 'on' | 'muted' | 'not set'

const layerState = ({ active, text }: UserInstructions.Instructions): LayerState =>
  active ? 'on' : text.trim() ? 'muted' : 'not set'

const useTogglesStyles = M.makeStyles((t) => ({
  // The shape carries the state (filled, slashed, hollow); color only reinforces
  // it. Each shade clears 3:1 on the light toolbar: these are enabled buttons.
  'not set': {
    color: t.palette.text.secondary,
  },
  muted: {
    color: t.palette.text.primary,
  },
  // The Indicator Rule: amber marks a layer that rides along with every message,
  // in its darker shade, since the indicator's own amber is below 3:1 on light.
  on: {
    color: t.palette.secondary.dark,
  },
  open: {
    backgroundColor: t.palette.action.selected,
  },
}))

const glyph = (icon: string, state: LayerState) =>
  state === 'muted' ? (
    <M.Icon fontSize="small">{`${icon}_off`}</M.Icon>
  ) : (
    <M.Icon
      className={state === 'not set' ? 'material-icons-outlined' : undefined}
      fontSize="small"
    >
      {icon}
    </M.Icon>
  )

interface InstructionsTogglesProps {
  instructions: UserInstructions.DualInstructions
  open: Layer | null
  onToggle: (layer: Layer) => void
  /** Layers whose editor holds a draft that differs from what's stored. */
  unsaved?: Partial<Record<Layer, boolean>>
  /** The InstructionsPanel's id, which the toggles control. */
  panelId?: string
}

/** One icon per layer for the docked composer's toolbar. */
export function InstructionsToggles({
  instructions,
  open,
  onToggle,
  unsaved = {},
  panelId,
}: InstructionsTogglesProps) {
  const classes = useTogglesStyles()
  return (
    <>
      {(Object.keys(LAYERS) as Layer[]).map((layer) => {
        const { icon, name } = LAYERS[layer]
        const state = layerState(instructions[layer])
        const label = `${name}: ${state}${unsaved[layer] ? ', unsaved changes' : ''}`
        return (
          <M.Tooltip key={layer} title={label}>
            <M.IconButton
              className={cx(classes[state], open === layer && classes.open)}
              aria-label={label}
              aria-expanded={open === layer}
              aria-controls={panelId}
              onClick={() => onToggle(layer)}
              size="small"
            >
              <M.Badge variant="dot" color="primary" invisible={!unsaved[layer]}>
                {glyph(icon, state)}
              </M.Badge>
            </M.IconButton>
          </M.Tooltip>
        )
      })}
    </>
  )
}

interface InstructionsPanelProps {
  className?: string
  instructions: UserInstructions.DualInstructions
  open: Layer | null
  onDirtyChange?: (layer: Layer, dirty: boolean) => void
  id?: string
}

/** The editor for the layer picked in InstructionsToggles; nothing while none is. */
export function InstructionsPanel({
  className,
  instructions,
  open,
  onDirtyChange,
  id,
}: InstructionsPanelProps) {
  const classes = useStyles()
  // The panel holds both drafts, so switching layers keeps one, and a pending
  // save's error, while only the open layer's editor is on screen.
  const editors: Record<Layer, Editor> = {
    global: UserInstructions.useInstructionsEditor(instructions.global),
    personal: UserInstructions.useInstructionsEditor(instructions.personal),
  }
  const globalDirty = editors.global.dirty
  const personalDirty = editors.personal.dirty
  // Cleared on the way out, so an unmounted panel leaves no unsaved mark behind.
  React.useEffect(() => {
    onDirtyChange?.('global', globalDirty)
    return () => onDirtyChange?.('global', false)
  }, [onDirtyChange, globalDirty])
  React.useEffect(() => {
    onDirtyChange?.('personal', personalDirty)
    return () => onDirtyChange?.('personal', false)
  }, [onDirtyChange, personalDirty])
  // Keep the closing layer's editor on screen while the panel collapses.
  const lastOpen = React.useRef<Layer>('global')
  if (open) lastOpen.current = open
  const shown = open ?? lastOpen.current
  return (
    // The hairline lives inside the Collapse, so a closed panel leaves no line behind.
    <M.Collapse in={!!open} className={className}>
      <div
        className={cx(classes.root, classes.body, classes.panelBody)}
        id={id}
        role="region"
        aria-label={LAYERS[shown].name}
      >
        <Section
          // One field per layer, so one layer's undo history never reaches the other.
          key={shown}
          {...LAYERS[shown]}
          instructions={instructions[shown]}
          editor={editors[shown]}
        />
      </div>
    </M.Collapse>
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

  const globalMuted = layerState(global) === 'muted'
  const personalMuted = layerState(personal) === 'muted'

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
          <OwnSection {...LAYERS.global} instructions={global} />
          <OwnSection {...LAYERS.personal} instructions={personal} />
        </div>
      </M.Collapse>
    </div>
  )
}

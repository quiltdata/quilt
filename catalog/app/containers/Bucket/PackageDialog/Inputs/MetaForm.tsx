import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import type { JsonSchema } from 'utils/JSONSchema'
import type * as Types from 'utils/types'

import { fieldMessage, hasValue, isFilled, pointer } from '../State/metaGuide'
import type { Suggestions } from '../State/metaSuggest'

type Widget = 'enum' | 'boolean' | 'integer' | 'number' | 'date' | 'string' | 'complex'

function widgetFor(prop: JsonSchema = {}): Widget {
  if (Array.isArray(prop.enum)) return 'enum'
  const types: unknown[] = Array.isArray(prop.type) ? prop.type : [prop.type]
  const type = types.find((x) => x !== 'null')
  if (type === 'boolean') return 'boolean'
  if (type === 'integer') return 'integer'
  if (type === 'number') return 'number'
  if (type === 'string') return prop.format === 'date' ? 'date' : 'string'
  if (type === undefined && !prop.properties && !prop.items) return 'string'
  return 'complex'
}

const isEmpty = (v: unknown) => !isFilled(v)

const display = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))

/** An enum option's label; quoted JSON when plain text would make two options look alike. */
function enumLabel(v: Types.Json, all: Types.Json[]) {
  const plain = display(v)
  if (plain === '') return '""'
  return all.filter((o) => display(o) === plain).length > 1 ? JSON.stringify(v) : plain
}

/** Errors that belong to `key`, including "required" reported on the root. */
function errorsFor(key: string, errors: (Error | ErrorObject)[]) {
  const at = pointer(key)
  return errors.filter((e) => {
    if (!('keyword' in e)) return false
    if (e.keyword === 'required' && !e.instancePath) {
      return e.params?.missingProperty === key
    }
    return e.instancePath === at || e.instancePath.startsWith(`${at}/`)
  })
}

/** Pending key for the unsaved new-field row; not a string the UI can produce as a key. */
export const NEW_FIELD = '\u0000new field'

let fieldIds = 0

const DATE = /^\d{4}-\d{2}-\d{2}$/

const useFieldStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  wide: {
    gridColumn: '1 / -1',
  },
  boolLabel: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    marginBottom: t.spacing(0.5),
  },
  boolGroup: {
    '& .MuiToggleButton-root': {
      ...t.typography.body2,
      minWidth: 64,
      padding: t.spacing(0.5, 2),
      textTransform: 'none',
    },
    '& .MuiToggleButton-root.Mui-selected': {
      background: t.palette.action.selected,
      color: t.palette.text.primary,
    },
  },
  suggestion: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.background.paper,
    border: `1px dashed ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.primary,
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(1),
    marginTop: t.spacing(0.5),
    minHeight: 36,
    padding: t.spacing(0, 0.5, 0, 1.5),
    textAlign: 'left',
    transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
    width: '100%',
    '&:hover': {
      background: t.palette.action.hover,
      borderColor: t.palette.text.secondary,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  suggestionIcon: {
    color: t.palette.text.secondary,
    fontSize: 16,
  },
  suggestionValue: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  suggestionUse: {
    ...t.typography.button,
    color: t.palette.primary.main,
    fontSize: 12,
    padding: t.spacing(0.5, 1),
  },
}))

interface FieldProps {
  disabled: boolean
  errors: (Error | ErrorObject)[]
  name: string
  onChange: (key: string, value: Types.Json | undefined) => void
  onShowTable: () => void
  prop: JsonSchema
  required: boolean
  suggestion?: { value: Types.Json; reason?: string }
  onUseSuggestion: (key: string, value: Types.Json) => void
  setPending?: (key: string, isPending: boolean) => void
  value: Types.Json | undefined
}

function Field({
  disabled,
  errors,
  name,
  onChange,
  onShowTable,
  prop,
  required,
  suggestion,
  onUseSuggestion,
  setPending,
  value,
}: FieldProps) {
  const classes = useFieldStyles()
  const typed = widgetFor(prop)
  // a date input shows a stored value it cannot parse as empty
  const widget =
    typed === 'date' && !isEmpty(value) && !DATE.test(String(value)) ? 'string' : typed
  const label = prop.title || name
  const error = errors[0]
  const enumIndex =
    widget === 'enum' && value !== undefined
      ? prop.enum.findIndex(
          (v: Types.Json) => JSON.stringify(v) === JSON.stringify(value),
        )
      : -1
  // A schema default is applied on save; show it so what is pushed is what is seen.
  const hasDefault = value === undefined && prop.default !== undefined
  const more = errors.length > 1 ? ` (+${errors.length - 1} more)` : ''
  let helper = error ? `${fieldMessage(error)}${more}` : prop.description
  if (!error && hasDefault) {
    helper = `Default: ${display(prop.default)}${prop.description ? ` · ${prop.description}` : ''}`
  }
  // a counter, not the key: "a.b" and "a_b" would collide once sanitized
  const [id] = React.useState(() => `meta-field-${(fieldIds += 1)}`)

  const numeric = widget === 'integer' || widget === 'number'
  const [numText, setNumText] = React.useState(() =>
    isEmpty(value) ? '' : display(value),
  )
  const numTextRef = React.useRef(numText)
  numTextRef.current = numText
  React.useEffect(() => {
    if (!numeric) return
    const t = numTextRef.current
    if (Number(t) === value && t.trim() !== '') return
    setNumText(isEmpty(value) ? '' : display(value))
    setPending?.(name, false)
  }, [name, numeric, setPending, value])
  React.useEffect(() => () => setPending?.(name, false), [name, setPending])

  const set = React.useCallback(
    (raw: string) => {
      if (numeric && raw.trim() === '') {
        setNumText(raw)
        setPending?.(name, false)
        return onChange(name, undefined)
      }
      if (raw === '') return onChange(name, undefined)
      if (widget === 'enum') return onChange(name, prop.enum[Number(raw)])
      if (widget === 'integer' || widget === 'number') {
        // the text is the source of truth while typing; "1." or "0.50" stay as typed
        setNumText(raw)
        const n = Number(raw)
        const complete =
          raw.trim() !== '' &&
          !Number.isNaN(n) &&
          /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(raw.trim())
        setPending?.(name, !complete)
        if (complete) onChange(name, n)
        return
      }
      onChange(name, raw)
    },
    [name, numeric, onChange, prop.enum, setPending, widget],
  )

  let input: React.ReactNode
  switch (widget) {
    case 'boolean': {
      const shown = value === undefined ? prop.default : value
      input = (
        <M.FormControl error={!!error} disabled={disabled} component="fieldset">
          <M.FormLabel component="legend" className={classes.boolLabel}>
            {required ? `${label} *` : label}
          </M.FormLabel>
          <Lab.ToggleButtonGroup
            aria-label={label}
            className={classes.boolGroup}
            exclusive
            // deselecting clears an optional field; a required one keeps its answer
            onChange={(_e, v) => {
              if (v === null) return required ? undefined : onChange(name, undefined)
              onChange(name, v === 'yes')
            }}
            size="small"
            value={shown === true ? 'yes' : shown === false ? 'no' : null}
          >
            <Lab.ToggleButton value="yes" id={id} disabled={disabled}>
              Yes
            </Lab.ToggleButton>
            <Lab.ToggleButton value="no" disabled={disabled}>
              No
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
          {helper && <M.FormHelperText>{helper}</M.FormHelperText>}
        </M.FormControl>
      )
      break
    }
    case 'complex':
      input = (
        <M.FormControl error={!!error}>
          <M.FormLabel>{required ? `${label} *` : label}</M.FormLabel>
          <M.FormHelperText>
            {isEmpty(value) ? 'Not set.' : `${display(value).slice(0, 80)}`}{' '}
            <M.Link component="button" type="button" onClick={onShowTable}>
              Edit in table view
            </M.Link>
          </M.FormHelperText>
          {errors.map((e, i) => {
            const at =
              'instancePath' in e ? e.instancePath.slice(pointer(name).length) : ''
            return (
              <M.FormHelperText key={i}>
                {at ? `${at.slice(1).replace(/\//g, '.')}: ` : ''}
                {fieldMessage(e)}
              </M.FormHelperText>
            )
          })}
        </M.FormControl>
      )
      break
    default:
      input = (
        <M.TextField
          disabled={disabled}
          error={!!error}
          fullWidth
          helperText={helper}
          id={id}
          InputLabelProps={widget === 'date' ? { shrink: true } : undefined}
          label={label}
          onChange={(e) => set(e.target.value)}
          required={required}
          select={widget === 'enum'}
          size="small"
          // numbers use a text input: a number input reports "" for a partial "-" or "1e"
          inputProps={
            widget === 'integer' || widget === 'number'
              ? { inputMode: widget === 'integer' ? 'numeric' : 'decimal' }
              : undefined
          }
          type={widget === 'date' ? 'date' : 'text'}
          value={
            // eslint-disable-next-line no-nested-ternary
            numeric
              ? numText
              : widget === 'enum'
                ? value === undefined
                  ? ''
                  : enumIndex === -1
                    ? 'current'
                    : String(enumIndex)
                : isEmpty(value)
                  ? ''
                  : display(value)
          }
          variant="outlined"
        >
          {widget === 'enum' && [
            <M.MenuItem key="" value="">
              <em>Not set</em>
            </M.MenuItem>,
            ...(enumIndex === -1 && value !== undefined
              ? [
                  <M.MenuItem key="__current" value="current" disabled>
                    {display(value)} (not an allowed value)
                  </M.MenuItem>,
                ]
              : []),
            ...prop.enum.map((v: Types.Json, i: number) => (
              // eslint-disable-next-line react/no-array-index-key
              <M.MenuItem key={i} value={String(i)}>
                {enumLabel(v, prop.enum)}
              </M.MenuItem>
            )),
          ]}
        </M.TextField>
      )
  }

  const showSuggestion =
    suggestion && !disabled && display(suggestion.value) !== display(value ?? '')
  return (
    <div className={cx(classes.root, { [classes.wide]: widget === 'complex' })}>
      {input}
      {showSuggestion && (
        <button
          type="button"
          className={classes.suggestion}
          onClick={() => {
            onUseSuggestion(name, suggestion.value)
            // the button goes away once used; keep focus on the field it filled
            window.setTimeout(() => document.getElementById(id)?.focus())
          }}
          title={
            suggestion.reason ? `AI suggestion: ${suggestion.reason}` : 'AI suggestion'
          }
          aria-label={`Use suggested ${label}: ${display(suggestion.value)}`}
          aria-describedby={suggestion.reason ? `${id}-reason` : undefined}
        >
          {suggestion.reason && (
            <span id={`${id}-reason`} hidden>
              {suggestion.reason}
            </span>
          )}
          <M.Icon className={classes.suggestionIcon} aria-hidden>
            auto_awesome
          </M.Icon>
          <span className={classes.suggestionValue}>{display(suggestion.value)}</span>
          <span className={classes.suggestionUse}>Use</span>
        </button>
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  section: {
    marginBottom: t.spacing(2),
    padding: t.spacing(2, 2, 2.5),
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(1.5, 1.5, 2),
    },
  },
  sectionHeader: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
    marginBottom: t.spacing(2),
    minHeight: 30,
  },
  sectionTitle: {
    ...t.typography.subtitle2,
    fontSize: 15,
  },
  sectionMeta: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  count: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    marginLeft: 'auto',
  },
  countDone: {
    color: t.palette.success.dark,
  },
  progress: {
    background: t.palette.action.hover,
    borderRadius: 2,
    height: 4,
    marginBottom: t.spacing(2.5),
    marginTop: t.spacing(-1),
  },
  progressBar: {
    background: t.palette.primary.main,
    borderRadius: 2,
  },
  progressDone: {
    background: t.palette.success.main,
  },
  grid: {
    alignItems: 'start',
    display: 'grid',
    gap: t.spacing(2.5, 2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    [t.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
    },
  },
  optionalToggle: {
    alignSelf: 'center',
    marginLeft: 'auto',
  },
}))

interface MetaFormProps {
  disabled: boolean
  errors: (Error | ErrorObject)[]
  onChange: (value: Types.JsonRecord) => void
  onShowTable: () => void
  onUseSuggestion: (key: string, value: Types.Json) => void
  schema: JsonSchema
  setPending?: (key: string, isPending: boolean) => void
  suggestions?: Suggestions
  value?: Types.JsonRecord
}

/**
 * The workflow schema's top-level fields as a form: required ones first, with
 * progress, then optional ones. Anything the form cannot express (nested
 * objects, arrays, keys outside the schema) stays editable in table view.
 */
export default function MetaForm({
  disabled,
  errors,
  onChange,
  onShowTable,
  onUseSuggestion,
  schema,
  setPending,
  suggestions,
  value,
}: MetaFormProps) {
  const classes = useStyles()
  const properties: Record<string, JsonSchema> = schema.properties || {}
  const required: string[] = React.useMemo(
    () =>
      (Array.isArray(schema.required) ? schema.required : []).filter(
        (k: unknown) => typeof k === 'string',
      ),
    [schema.required],
  )
  const optional = Object.keys(properties).filter((k) => !required.includes(k))
  const [showOptional, setShowOptional] = React.useState(true)

  const setField = React.useCallback(
    (key: string, v: Types.Json | undefined) => {
      const next = { ...value }
      if (v === undefined) delete next[key]
      else next[key] = v
      onChange(next)
    },
    [onChange, value],
  )

  const filled = required.filter(
    (k) =>
      hasValue(
        value && Object.hasOwn(value, k) ? value[k] : properties[k]?.default,
        properties[k],
      ) && !errorsFor(k, errors).length,
  ).length

  const field = (key: string, isRequired: boolean) => (
    <Field
      disabled={disabled}
      errors={errorsFor(key, errors)}
      key={key}
      name={key}
      onChange={setField}
      onShowTable={onShowTable}
      onUseSuggestion={onUseSuggestion}
      prop={properties[key] || {}}
      setPending={setPending}
      required={isRequired}
      suggestion={suggestions?.[key]}
      value={value?.[key]}
    />
  )

  return (
    <>
      {!!required.length && (
        <M.Paper variant="outlined" className={classes.section}>
          <div className={classes.sectionHeader}>
            <span className={classes.sectionTitle}>Required</span>
            <span
              className={cx(classes.count, {
                [classes.countDone]: filled === required.length,
              })}
              role="status"
            >
              {filled} of {required.length} complete
            </span>
          </div>
          <M.LinearProgress
            aria-label={`${filled} of ${required.length} required fields complete`}
            className={classes.progress}
            classes={{
              bar: cx(classes.progressBar, {
                [classes.progressDone]: filled === required.length,
              }),
            }}
            variant="determinate"
            value={(filled / required.length) * 100}
          />
          <div className={classes.grid}>{required.map((k) => field(k, true))}</div>
        </M.Paper>
      )}
      {!!optional.length && (
        <M.Paper variant="outlined" className={classes.section}>
          <div className={classes.sectionHeader}>
            <span className={classes.sectionTitle}>Optional</span>
            <span className={classes.sectionMeta}>{optional.length}</span>
            <M.Button
              className={classes.optionalToggle}
              size="small"
              onClick={() => setShowOptional((x) => !x)}
              aria-expanded={showOptional}
            >
              {showOptional ? 'Hide' : 'Show'}
            </M.Button>
          </div>
          <M.Collapse in={showOptional}>
            <div className={classes.grid}>{optional.map((k) => field(k, false))}</div>
          </M.Collapse>
        </M.Paper>
      )}
    </>
  )
}

const useFreeStyles = M.makeStyles((t) => ({
  row: {
    alignItems: 'flex-start',
    display: 'grid',
    gap: t.spacing(1.5),
    gridTemplateColumns: 'minmax(120px, 2fr) minmax(160px, 3fr) auto',
    [t.breakpoints.down('xs')]: {
      gap: t.spacing(1),
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
    },
    '& + &': {
      marginTop: t.spacing(1.5),
    },
  },
  remove: {
    marginTop: t.spacing(0.5),
  },
  add: {
    marginTop: t.spacing(1.5),
  },
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1),
  },
}))

interface FreeFieldsProps {
  setPending?: (key: string, isPending: boolean) => void
  description: string
  disabled: boolean
  /** Keys the schema form already shows. */
  exclude?: readonly string[]
  onChange: (value: Types.JsonRecord) => void
  title: string
  value?: Types.JsonRecord
}

/**
 * Metadata keys without a schema field, as name/value rows. Values that were
 * not strings round-trip as JSON; anything typed into a new row is a string.
 */
interface FreeRowProps {
  disabled: boolean
  setPending?: (key: string, isPending: boolean) => void
  name: string
  onRemove: () => void
  onRename: (to: string) => string | null
  onValue: (v: Types.Json) => void
  value: Types.Json
}

/**
 * One name/value row. The name and the text of a non-string value are drafts
 * kept locally, so an invalid rename or half-typed JSON never reaches metadata.
 */
function FreeRow({
  disabled,
  name,
  onRemove,
  onRename,
  onValue,
  setPending,
  value,
}: FreeRowProps) {
  const free = useFreeStyles()
  const typed = typeof value !== 'string'
  const [nameDraft, setNameDraft] = React.useState(name)
  const [nameError, setNameError] = React.useState<string | null>(null)
  const [text, setText] = React.useState(() => display(value ?? ''))
  const [textError, setTextError] = React.useState<string | null>(null)
  React.useEffect(() => setNameDraft(name), [name])
  React.useEffect(() => {
    setText((t) => {
      if (!typed) return display(value ?? '')
      try {
        // the text already means this value; keep its spacing and caret
        if (JSON.stringify(JSON.parse(t)) === JSON.stringify(value)) return t
      } catch {
        // not parseable: an outside change replaces it
      }
      return display(value ?? '')
    })
    setTextError(null)
  }, [typed, value])

  const commitName = () => {
    const to = nameDraft.trim()
    if (to === name) return setNameError(null)
    // a rename remounts the row, which would drop the unfinished value
    if (textError) return setNameError('Finish the value first')
    setNameError(onRename(to))
  }
  const changeText = (raw: string) => {
    setText(raw)
    if (!typed) return onValue(raw)
    try {
      onValue(JSON.parse(raw))
      setTextError(null)
    } catch {
      setTextError('Not valid JSON yet. Finish it, or undo the change, before saving')
    }
  }
  const unresolved = !!nameError || !!textError
  React.useEffect(() => {
    setPending?.(name, unresolved)
    return () => setPending?.(name, false)
  }, [name, setPending, unresolved])
  return (
    <div className={free.row}>
      <M.TextField
        disabled={disabled}
        error={!!nameError}
        helperText={nameError || undefined}
        inputProps={{ 'aria-label': `Name of field ${name}` }}
        label="Name"
        onBlur={commitName}
        onChange={(e) => setNameDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitName())}
        size="small"
        value={nameDraft}
        variant="outlined"
      />
      <M.TextField
        disabled={disabled}
        error={!!textError}
        helperText={textError || (typed ? 'JSON value' : undefined)}
        inputProps={{ 'aria-label': `Value of ${name}` }}
        label="Value"
        multiline={typed && typeof value === 'object' && value !== null}
        onChange={(e) => changeText(e.target.value)}
        size="small"
        value={text}
        variant="outlined"
      />
      <M.IconButton
        aria-label={`Remove ${name}`}
        className={free.remove}
        disabled={disabled}
        onClick={onRemove}
        size="small"
      >
        <M.Icon fontSize="small">close</M.Icon>
      </M.IconButton>
    </div>
  )
}

export function FreeFields({
  description,
  disabled,
  exclude = [],
  onChange,
  setPending,
  title,
  value,
}: FreeFieldsProps) {
  const classes = useStyles()
  const free = useFreeStyles()
  const entries = Object.entries(value || {}).filter(([k]) => !exclude.includes(k))
  const [draft, setDraft] = React.useState<{ key: string; value: string } | null>(null)
  const draftRef = React.useRef<HTMLDivElement>(null)

  const taken = (k: string) => Object.hasOwn(value || {}, k) || exclude.includes(k)
  const rename = (from: string, to: string): string | null => {
    if (!to) return 'Enter a name'
    if (taken(to)) return 'Already used'
    onChange(
      Object.fromEntries(
        Object.entries(value || {}).map(([k, v]) => (k === from ? [to, v] : [k, v])),
      ),
    )
    return null
  }
  const remove = (key: string) => {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }
  // Commit only when focus leaves the whole draft row, so Tab from Name to Value keeps it.
  const commitDraft = (e?: React.FocusEvent) => {
    if (e && draftRef.current?.contains(e.relatedTarget as Node)) return
    const key = draft?.key.trim()
    if (!draft || !key || taken(key)) return
    onChange({ ...value, [key]: draft.value })
    setDraft(null)
  }
  const draftError = !!draft?.key.trim() && taken(draft.key.trim())
  // a draft that cannot be saved as it stands holds the submit until fixed or discarded
  const draftStuck =
    !!draft && (draftError || (!draft.key.trim() && !!draft.value.trim()))
  React.useEffect(() => {
    setPending?.(NEW_FIELD, draftStuck)
    return () => setPending?.(NEW_FIELD, false)
  }, [draftStuck, setPending])

  return (
    <M.Paper variant="outlined" className={classes.section}>
      <div className={classes.sectionHeader}>
        <span className={classes.sectionTitle}>{title}</span>
      </div>
      {!entries.length && !draft && <div className={free.empty}>{description}</div>}
      {entries.map(([k, v]) => (
        <FreeRow
          disabled={disabled}
          key={k}
          name={k}
          onRemove={() => remove(k)}
          onRename={(to) => rename(k, to)}
          onValue={(next) => onChange({ ...value, [k]: next })}
          setPending={setPending}
          value={v}
        />
      ))}
      {draft && (
        <div className={free.row} ref={draftRef} onBlur={commitDraft}>
          <M.TextField
            autoFocus
            error={draftError}
            helperText={draftError ? 'Already used' : undefined}
            label="Name"
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitDraft())}
            size="small"
            value={draft.key}
            variant="outlined"
          />
          <M.TextField
            label="Value"
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitDraft())}
            size="small"
            value={draft.value}
            variant="outlined"
          />
          <M.IconButton
            aria-label="Discard new field"
            className={free.remove}
            onClick={() => setDraft(null)}
            // keep focus in the row, so the blur that would save the draft never fires
            onMouseDown={(e) => e.preventDefault()}
            size="small"
          >
            <M.Icon fontSize="small">close</M.Icon>
          </M.IconButton>
        </div>
      )}
      <M.Button
        className={free.add}
        color="primary"
        disabled={disabled || !!draft}
        onClick={() => setDraft({ key: '', value: '' })}
        size="small"
        startIcon={<M.Icon fontSize="small">add</M.Icon>}
      >
        Add field
      </M.Button>
    </M.Paper>
  )
}

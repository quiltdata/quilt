import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { JsonSchema } from 'utils/JSONSchema'
import type * as Types from 'utils/types'

import { fieldMessage } from '../State/metaGuide'
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

const isEmpty = (v: unknown) => v === undefined || v === null || v === ''

const display = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))

const pointer = (key: string) => `/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`

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
  switch: {
    marginLeft: 0,
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
  value,
}: FieldProps) {
  const classes = useFieldStyles()
  const typed = widgetFor(prop)
  // a date input shows a stored value it cannot parse as empty
  const widget =
    typed === 'date' && !isEmpty(value) && !DATE.test(String(value)) ? 'string' : typed
  const label = prop.title || name
  const error = errors[0]
  const helper = error ? fieldMessage(error) : prop.description
  const id = `meta-field-${name}`

  const set = React.useCallback(
    (raw: string) => {
      if (raw === '') return onChange(name, undefined)
      if (widget === 'enum') return onChange(name, prop.enum[Number(raw)])
      if (widget === 'integer' || widget === 'number') {
        const n = Number(raw)
        return onChange(name, Number.isNaN(n) ? raw : n)
      }
      onChange(name, raw)
    },
    [name, onChange, prop.enum, widget],
  )

  let input: React.ReactNode
  switch (widget) {
    case 'boolean':
      input = (
        <M.FormControl error={!!error} disabled={disabled}>
          <M.FormControlLabel
            className={classes.switch}
            control={
              <M.Switch
                checked={value === true}
                color="primary"
                id={id}
                onChange={(e) => onChange(name, e.target.checked)}
              />
            }
            label={required ? `${label} *` : label}
          />
          {helper && <M.FormHelperText>{helper}</M.FormHelperText>}
        </M.FormControl>
      )
      break
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
          {error && <M.FormHelperText>{fieldMessage(error)}</M.FormHelperText>}
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
          type={
            // eslint-disable-next-line no-nested-ternary
            widget === 'date'
              ? 'date'
              : widget === 'integer' || widget === 'number'
                ? 'number'
                : 'text'
          }
          value={
            // eslint-disable-next-line no-nested-ternary
            isEmpty(value)
              ? ''
              : widget === 'enum'
                ? String(
                    prop.enum.findIndex((v: Types.Json) => display(v) === display(value)),
                  )
                : display(value)
          }
          variant="outlined"
        >
          {widget === 'enum' && [
            <M.MenuItem key="" value="">
              <em>Not set</em>
            </M.MenuItem>,
            ...prop.enum.map((v: Types.Json, i: number) => (
              <M.MenuItem key={display(v)} value={String(i)}>
                {display(v)}
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
          onClick={() => onChange(name, suggestion.value)}
          title={
            suggestion.reason ? `AI suggestion: ${suggestion.reason}` : 'AI suggestion'
          }
          aria-label={`Use suggested ${label}: ${display(suggestion.value)}`}
        >
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
  schema: JsonSchema
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
  schema,
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
    (k) => !isEmpty(value?.[k] ?? properties[k]?.default) && !errorsFor(k, errors).length,
  ).length

  const field = (key: string, isRequired: boolean) => (
    <Field
      disabled={disabled}
      errors={errorsFor(key, errors)}
      key={key}
      name={key}
      onChange={setField}
      onShowTable={onShowTable}
      prop={properties[key] || {}}
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
export function FreeFields({
  description,
  disabled,
  exclude = [],
  onChange,
  title,
  value,
}: FreeFieldsProps) {
  const classes = useStyles()
  const free = useFreeStyles()
  const entries = Object.entries(value || {}).filter(([k]) => !exclude.includes(k))
  const [draft, setDraft] = React.useState<{ key: string; value: string } | null>(null)

  const rename = (from: string, to: string) => {
    if (!to || to === from || Object.hasOwn(value || {}, to)) return
    onChange(
      Object.fromEntries(
        Object.entries(value || {}).map(([k, v]) => (k === from ? [to, v] : [k, v])),
      ),
    )
  }
  const setValue = (key: string, raw: string) => {
    const prev = value?.[key]
    let next: Types.Json = raw
    if (typeof prev !== 'string' && prev !== undefined) {
      try {
        next = JSON.parse(raw)
      } catch {
        next = raw
      }
    }
    onChange({ ...value, [key]: next })
  }
  const remove = (key: string) => {
    const next = { ...value }
    delete next[key]
    onChange(next)
  }
  const commitDraft = () => {
    if (!draft?.key || Object.hasOwn(value || {}, draft.key)) return
    onChange({ ...value, [draft.key]: draft.value })
    setDraft(null)
  }

  return (
    <M.Paper variant="outlined" className={classes.section}>
      <div className={classes.sectionHeader}>
        <span className={classes.sectionTitle}>{title}</span>
      </div>
      {!entries.length && !draft && <div className={free.empty}>{description}</div>}
      {entries.map(([k, v]) => (
        <div className={free.row} key={k}>
          <M.TextField
            defaultValue={k}
            disabled={disabled}
            inputProps={{ 'aria-label': `Name of field ${k}` }}
            label="Name"
            onBlur={(e) => rename(k, e.target.value.trim())}
            size="small"
            variant="outlined"
          />
          <M.TextField
            disabled={disabled}
            inputProps={{ 'aria-label': `Value of ${k}` }}
            label="Value"
            multiline={typeof v === 'object' && v !== null}
            onChange={(e) => setValue(k, e.target.value)}
            size="small"
            value={display(v ?? '')}
            variant="outlined"
          />
          <M.IconButton
            aria-label={`Remove ${k}`}
            className={free.remove}
            disabled={disabled}
            onClick={() => remove(k)}
            size="small"
          >
            <M.Icon fontSize="small">close</M.Icon>
          </M.IconButton>
        </div>
      ))}
      {draft && (
        <div className={free.row}>
          <M.TextField
            autoFocus
            error={!!draft.key && Object.hasOwn(value || {}, draft.key)}
            helperText={
              draft.key && Object.hasOwn(value || {}, draft.key)
                ? 'Already used'
                : undefined
            }
            label="Name"
            onBlur={commitDraft}
            onChange={(e) => setDraft({ ...draft, key: e.target.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitDraft())}
            size="small"
            value={draft.key}
            variant="outlined"
          />
          <M.TextField
            label="Value"
            onBlur={commitDraft}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            size="small"
            value={draft.value}
            variant="outlined"
          />
          <M.IconButton
            aria-label="Discard new field"
            className={free.remove}
            onClick={() => setDraft(null)}
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

import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { JsonSchema } from 'utils/JSONSchema'
import type * as Types from 'utils/types'

import { humanizeError } from '../State/metaGuide'
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
    background: t.palette.background.default,
    border: `1px dashed ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(0.75),
    marginTop: t.spacing(0.75),
    padding: t.spacing(0.25, 0.25, 0.25, 1),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      borderColor: t.palette.text.secondary,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 1,
    },
  },
  suggestionValue: {
    flexGrow: 1,
    fontWeight: t.typography.fontWeightMedium,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  suggestionUse: {
    color: t.palette.primary.main,
    fontWeight: t.typography.fontWeightMedium,
    padding: t.spacing(0.25, 1),
    textTransform: 'uppercase',
    fontSize: 12,
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
  const helper = error ? humanizeError(error) : prop.description
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
          {error && <M.FormHelperText>{humanizeError(error)}</M.FormHelperText>}
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
          <M.Icon fontSize="small" color="secondary">
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
    padding: t.spacing(2),
  },
  sectionHeader: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    marginBottom: t.spacing(2),
  },
  sectionTitle: {
    ...t.typography.subtitle1,
    fontWeight: t.typography.fontWeightMedium,
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
    borderRadius: 2,
    height: 4,
    marginBottom: t.spacing(2),
    marginTop: t.spacing(-1),
  },
  grid: {
    display: 'grid',
    gap: t.spacing(2.5, 2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  },
  optionalToggle: {
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
            className={classes.progress}
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
            <M.Button
              className={classes.optionalToggle}
              size="small"
              onClick={() => setShowOptional((x) => !x)}
              aria-expanded={showOptional}
            >
              {showOptional ? 'Hide' : `Show ${optional.length}`}
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

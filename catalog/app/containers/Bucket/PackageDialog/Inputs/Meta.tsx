import type { ErrorObject } from 'ajv'
import cx from 'classnames'
import mime from 'mime-types'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonEditor from 'components/JsonEditor'
import { JsonValue, ValidationErrors } from 'components/JsonEditor/constants'
import JsonValidationErrors from 'components/JsonValidationErrors'
import MetadataEditor from 'components/MetadataEditor'
import * as Notifications from 'containers/Notifications'
import useDragging from 'utils/dragging'
import type { JsonSchema } from 'utils/JSONSchema'
import * as spreadsheets from 'utils/spreadsheets'
import { readableBytes } from 'utils/string'
import { JsonRecord } from 'utils/types'

import type { FormStatus } from '../State/form'
import { mkSubmitValidator } from '../State/schema'
import type { SchemaStatus } from '../State/schema'
import { IMPORT, pendingLabel } from '../State/meta'
import type { MetaState } from '../State/meta'
import { humanizeError, invalidKeys, requiredFields, topKey } from '../State/metaGuide'
import { hasLossyToken, newErrorsFrom, useMetaSuggestions } from '../State/metaSuggest'
import type { SuggestState } from '../State/metaSuggest'

import MetaForm, { FreeFields } from './MetaForm'
import MetaSummary from './MetaSummary'
import { MetaInputSkeleton } from '../Skeleton'

const noop = () => {}

const MAX_META_FILE_SIZE = 10 * 1000 * 1000 // 10MB

const useDialogStyles = M.makeStyles({
  paper: {
    height: '100vh',
  },
})

const useStyles = M.makeStyles({
  content: {
    height: '100%',
  },
  switch: {
    marginRight: 'auto',
  },
})

interface DialogProps {
  onChange: (value: JsonValue) => void
  onClose: () => void
  open: boolean
  value: JsonValue
  schema?: JsonSchema
}

function Dialog({ onChange, onClose, open, schema, value }: DialogProps) {
  const [innerValue, setInnerValue] = React.useState(value)
  const classes = useStyles()
  const dialogClasses = useDialogStyles()
  const [isRaw, setRaw] = React.useState(false)
  const handleSubmit = React.useCallback(() => {
    onChange(innerValue)
    onClose()
  }, [innerValue, onChange, onClose])
  const handleCancel = React.useCallback(() => {
    setInnerValue(value)
    onClose()
  }, [onClose, value])
  return (
    <M.Dialog
      fullWidth
      maxWidth="xl"
      onClose={handleCancel}
      open={open}
      classes={dialogClasses}
    >
      <M.DialogTitle>Package-level metadata</M.DialogTitle>
      <M.DialogContent className={classes.content}>
        <MetadataEditor
          multiColumned
          isRaw={isRaw}
          value={innerValue}
          onChange={setInnerValue}
          schema={schema}
        />
      </M.DialogContent>
      <M.DialogActions>
        <M.FormControlLabel
          className={classes.switch}
          control={<M.Switch checked={isRaw} onChange={() => setRaw(!isRaw)} />}
          label="Edit as JSON"
        />
        <M.Button onClick={handleCancel}>Discard</M.Button>
        <M.Button onClick={handleSubmit} variant="contained" color="primary">
          Save
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const readTextFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onabort = () => {
      reject(new Error('abort'))
    }
    reader.onerror = () => {
      reject(reader.error)
    }
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.readAsText(file)
  })

const readFile = (file: File, schema?: JsonSchema): Promise<string | JsonRecord> => {
  const mimeType = mime.extension(file.type)
  if (mimeType && /ods|odt|csv|xlsx|xls/.test(mimeType))
    return spreadsheets.readAgainstSchema(file, schema)
  return readTextFile(file)
}

const useMetaInputStyles = M.makeStyles((t) => ({
  header: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(2),
    height: 24,
  },
  btn: {
    fontSize: 11,
    height: 24,
    paddingBottom: 0,
    paddingLeft: 7,
    paddingRight: 7,
    paddingTop: 0,
  },
  errors: {
    marginTop: t.spacing(1),
  },
  add: {
    marginTop: t.spacing(2),
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    marginTop: t.spacing(1),
  },
  sep: {
    ...t.typography.body1,
    marginLeft: t.spacing(1),
    marginRight: t.spacing(1),
  },
  json: {
    alignItems: 'flex-start',
    display: 'flex',
  },
  jsonTrigger: {
    marginLeft: 'auto',
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    margin: t.spacing(2, 0),
  },
  toolbarActions: {
    display: 'flex',
    gap: t.spacing(0.5),
    marginLeft: 'auto',
  },
  viewToggle: {
    '& .MuiToggleButton-sizeSmall': {
      ...t.typography.button,
      color: t.palette.text.secondary,
      fontSize: 13,
      padding: t.spacing(0.5, 1.5),
      textTransform: 'none',
    },
    '& .MuiToggleButton-label': {
      gap: t.spacing(0.75),
    },
    '& .MuiToggleButton-label .MuiIcon-root': {
      fontSize: 18,
    },
    '& .MuiToggleButton-root.Mui-selected': {
      background: t.palette.action.selected,
      color: t.palette.text.primary,
    },
    '& .MuiToggleButton-root.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },

  key: {
    flexBasis: 100,
    flexGrow: 1,
  },
  value: {
    flexBasis: 100,
    flexGrow: 2,
  },
  dropzone: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    position: 'relative',
  },
  // The guided panel sits in the same flex column; without a floor the editor
  // is the item that shrinks, down to nothing on short windows.
  dropzoneGuided: {
    flexShrink: 0,
    minHeight: t.spacing(30),
  },
  metaContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  outlined: {
    bottom: '1px',
    left: 0,
    outline: `2px dashed ${t.palette.primary.light}`,
    outlineOffset: '-2px',
    position: 'absolute',
    right: 0,
    top: '1px',
    zIndex: 1,
  },
  overlay: {
    background: 'rgba(255,255,255,0.6)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    transition: 'background 0.15s ease',
    zIndex: 1,
  },
  overlayDraggable: {
    bottom: '3px',
    left: '2px',
    right: '2px',
    top: '3px',
  },
  overlayDragActive: {
    background: M.fade(t.palette.grey[200], 0.8),
  },
  overlayContents: {
    alignItems: 'center',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    maxHeight: 120,
  },
  overlayText: {
    ...t.typography.body1,
    color: t.palette.text.secondary,
  },
  overlayProgress: {
    marginRight: t.spacing(1),
  },
}))

const useRequiredFieldsStyles = M.makeStyles((t) => ({
  root: {
    borderLeft: `4px solid ${t.palette.warning.main}`,
    marginBottom: t.spacing(2),
    padding: t.spacing(1.5, 2),
  },
  complete: {
    borderLeftColor: t.palette.success.main,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  title: {
    ...t.typography.subtitle2,
    flexGrow: 1,
  },
  count: {
    ...t.typography.subtitle2,
    fontVariantNumeric: 'tabular-nums',
  },
  progress: {
    borderRadius: 2,
    height: 4,
    margin: t.spacing(1, 0),
  },
  list: {
    display: 'grid',
    gap: t.spacing(0.75, 2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  field: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: t.spacing(1),
    minWidth: 0,
  },
  icon: {
    color: t.palette.text.disabled,
    marginTop: 1,
  },
  iconFilled: {
    color: t.palette.success.main,
  },
  iconInvalid: {
    color: t.palette.error.main,
  },
  fieldText: {
    minWidth: 0,
  },
  fieldName: {
    ...t.typography.body2,
    fontWeight: t.typography.fontWeightMedium,
  },
  fieldKey: {
    color: t.palette.text.secondary,
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: 12,
    marginLeft: t.spacing(0.75),
  },
  fieldHint: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    display: 'block',
  },
  footer: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1.25),
  },
}))

interface RequiredFieldsProps {
  blocked: boolean
  errors: ValidationErrors
  schema?: JsonSchema
  value?: JsonRecord
}

/** What the workflow requires, kept in view so a blocked Create explains itself. */
function RequiredFields({ blocked, errors, schema, value }: RequiredFieldsProps) {
  const classes = useRequiredFieldsStyles()
  const fields = React.useMemo(
    () => requiredFields(schema, value, invalidKeys(errors)),
    [errors, schema, value],
  )
  if (!fields.length) return null
  const filled = fields.filter((f) => f.filled && !f.invalid).length
  const complete = filled === fields.length
  let footer = 'The package cannot be saved until every required field is filled.'
  if (fields.some((f) => f.invalid)) {
    footer = 'Fix the fields marked in red to save; the problems are listed below.'
  } else if (complete) {
    footer = blocked
      ? 'All required fields are filled. Fix the problems listed below to save.'
      : 'All required fields are filled.'
  }
  return (
    <M.Paper
      variant="outlined"
      className={cx(classes.root, { [classes.complete]: complete && !blocked })}
      role="status"
      aria-label={`Required metadata: ${filled} of ${fields.length} filled`}
    >
      <div className={classes.header}>
        <M.Icon fontSize="small" color={complete ? 'inherit' : 'action'}>
          {complete ? 'task_alt' : 'checklist'}
        </M.Icon>
        <span className={classes.title}>Required by this workflow</span>
        <span className={classes.count}>
          {filled} of {fields.length} filled
        </span>
      </div>
      <M.LinearProgress
        className={classes.progress}
        variant="determinate"
        value={(filled / fields.length) * 100}
      />
      <ul className={classes.list}>
        {fields.map((f) => (
          <li key={f.key} className={classes.field}>
            <M.Icon
              fontSize="small"
              className={cx(classes.icon, {
                [classes.iconFilled]: f.filled && !f.invalid,
                [classes.iconInvalid]: f.invalid,
              })}
              aria-label={f.invalid ? 'invalid' : f.filled ? 'filled' : 'missing'}
            >
              {f.invalid ? 'error' : f.filled ? 'check_circle' : 'radio_button_unchecked'}
            </M.Icon>
            <div className={classes.fieldText}>
              <span className={classes.fieldName}>{f.title || f.key}</span>
              {f.title && <code className={classes.fieldKey}>{f.key}</code>}
              {f.description && (
                <span className={classes.fieldHint}>{f.description}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className={classes.footer}>{footer}</div>
    </M.Paper>
  )
}

const useSuggestBarStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.background.default,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.secondary,
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1, 1.5),
    marginBottom: t.spacing(2),
    minHeight: 52,
    padding: t.spacing(1, 1, 1, 1.5),
  },
  icon: {
    color: t.palette.text.secondary,
  },
  text: {
    flex: '1 1 220px',
    minWidth: 0,
  },
  actions: {
    display: 'flex',
    gap: t.spacing(0.5),
    marginLeft: 'auto',
  },
}))

interface SuggestBarProps {
  disabled: boolean
  onRequest: () => void
  onUseAll: () => void
  state: SuggestState
  /** Suggestions that still fit the metadata as it is now. */
  usable: number
}

function SuggestBar({ disabled, onRequest, onUseAll, state, usable }: SuggestBarProps) {
  const classes = useSuggestBarStyles()
  if (state._tag === 'unavailable') return null
  const icon = (
    <M.Icon className={classes.icon} fontSize="small" aria-hidden>
      auto_awesome
    </M.Icon>
  )
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  switch (state._tag) {
    case 'idle':
      return (
        <div className={classes.root}>
          {icon}
          <span className={classes.text}>
            Fill fields from similar packages you can read and the files being added.
          </span>
          <div className={classes.actions}>
            <M.Button
              color="primary"
              disabled={disabled}
              onClick={onRequest}
              size="small"
              variant="outlined"
            >
              Suggest values
            </M.Button>
          </div>
        </div>
      )
    case 'loading':
      return (
        <div className={classes.root} role="status">
          <M.CircularProgress size={18} />
          <span className={classes.text}>Reading similar packages…</span>
        </div>
      )
    case 'error':
      return (
        <div className={classes.root} role="alert">
          <M.Icon className={classes.icon} fontSize="small" aria-hidden>
            error_outline
          </M.Icon>
          <span className={classes.text}>Couldn't get suggestions. {state.message}</span>
          <div className={classes.actions}>
            <M.Button disabled={disabled} onClick={onRequest} size="small">
              Try again
            </M.Button>
          </div>
        </div>
      )
    case 'ready': {
      // later edits can rule suggestions out; count only those still offered
      const n = usable
      return (
        <div className={classes.root} role="status">
          {icon}
          <span className={classes.text}>
            {n
              ? `${plural(n, 'suggestion')} from ${plural(state.examples, 'similar package')}. Review each before using it.`
              : state.examples
                ? `No suggestions: ${plural(state.examples, 'similar package')} gave no clear values.`
                : 'No suggestions: there are no earlier packages with this workflow to learn from yet.'}
          </span>
          <div className={classes.actions}>
            <M.Button disabled={disabled} onClick={onRequest} size="small">
              Refresh
            </M.Button>
            {!!n && (
              <M.Button
                color="primary"
                disableElevation
                disabled={disabled}
                onClick={onUseAll}
                size="small"
                variant="contained"
              >
                Use all
              </M.Button>
            )}
          </div>
        </div>
      )
    }
  }
}

export interface SuggestContext {
  bucket: string
  files: string[]
  name?: string
  workflow?: string
}

interface MetaInputProps {
  className?: string
  errors: ValidationErrors
  value: JsonRecord | undefined
  onChange: (value: JsonRecord) => void
  schema?: JsonSchema
  disabled: boolean
  guided: boolean
  blocked: boolean
  warnings: ErrorObject[]
  suggest?: SuggestContext
  /** Missing-field errors are due: the user edited metadata or tried to submit. */
  insist: boolean
  pending?: readonly string[]
  setPending?: (key: string, isPending: boolean) => void
}

const MetaInput = React.forwardRef<HTMLDivElement, MetaInputProps>(function MetaInput(
  {
    blocked,
    className,
    disabled,
    errors,
    guided,
    insist,
    pending = [],
    setPending,
    value,
    onChange,
    schema,
    suggest,
    warnings,
  },
  ref,
) {
  const classes = useMetaInputStyles()
  const hasForm =
    guided && !!schema?.properties && !!Object.keys(schema.properties).length
  const [view, setView] = React.useState<'form' | 'table'>('form')
  const formView = guided && view === 'form'
  const suggestions = useMetaSuggestions({
    bucket: suggest?.bucket || '',
    files: suggest?.files || [],
    name: suggest?.name,
    schema: hasForm && suggest ? schema : undefined,
    value,
    workflow: suggest?.workflow,
  })
  const rawSuggested =
    suggestions.state._tag === 'ready' ? suggestions.state.suggestions : undefined
  // Guided: the required-fields panel already lists missing root fields, so
  // those errors would only repeat it.
  const humanErrors = React.useMemo(
    () =>
      guided
        ? errors
            // only drop a missing-field error the panel or the form already shows
            .filter(
              (e) =>
                !(
                  'keyword' in e &&
                  e.keyword === 'required' &&
                  !e.instancePath &&
                  // the form or the panel names it only if the schema declares it
                  !!schema?.properties?.[e.params?.missingProperty] &&
                  Array.isArray(schema?.required) &&
                  schema.required.includes(e.params?.missingProperty)
                ),
            )
            // the form shows its own fields' errors under each field
            .filter(
              (e) =>
                !formView ||
                !('keyword' in e) ||
                !Object.hasOwn(schema?.properties || {}, topKey(e.instancePath)),
            )
            .map((e) => new Error(humanizeError(e)))
        : errors,
    [errors, formView, guided, schema],
  )
  const problems = (
    <>
      <JsonValidationErrors className={classes.errors} error={humanErrors} />
      {warnings.map((w) => (
        <Lab.Alert
          className={classes.errors}
          key={w.instancePath + w.message}
          severity="warning"
        >
          {humanizeError(w)} (not enforced when the package is pushed)
        </Lab.Alert>
      ))}
    </>
  )

  const [open, setOpen] = React.useState(false)
  const closeEditor = React.useCallback(() => setOpen(false), [setOpen])
  const openEditor = React.useCallback(() => setOpen(true), [setOpen])

  const onChangeFullscreen = React.useCallback(
    (json: JsonRecord) => {
      setJsonInlineEditorKey(R.inc)
      onChange(json)
    },
    [onChange],
  )

  const onChangeInline = React.useCallback(
    (json: JsonRecord) => {
      setJsonFullscreenEditorKey(R.inc)
      onChange(json)
    },
    [onChange],
  )

  // Form edits, like inline grid edits, reset the full-screen editor so it never saves a stale copy.
  const onChangeForm = onChangeInline

  const { push: notify } = Notifications.use()

  // Suggestions are applied only if the metadata they produce, together, is no worse than now.
  const validateFull = React.useMemo(() => {
    if (!schema) return null
    return mkSubmitValidator(schema) as (x: JsonRecord) => (Error | ErrorObject)[]
  }, [schema])
  // suggestions were checked against the metadata when asked; offer only those that still fit
  const suggested = React.useMemo(() => {
    if (!rawSuggested || !validateFull) return rawSuggested
    const base = (value || {}) as JsonRecord
    const adds = newErrorsFrom(validateFull, base)
    return Object.fromEntries(
      Object.entries(rawSuggested).filter(
        ([k, sg]) => !adds({ ...base, [k]: sg.value }).length,
      ),
    )
  }, [rawSuggested, validateFull, value])
  const applySuggestions = React.useCallback(
    (picks: Record<string, JsonValue>) => {
      if (!validateFull || !Object.keys(picks).length) return
      const base = (value || {}) as JsonRecord
      const adds = newErrorsFrom(validateFull, base)
      const introduces = (candidate: JsonRecord) => adds(candidate).length > 0
      let next = { ...value } as JsonRecord
      let kept = 0
      // Greedy: keep each pick that does not add a new error to what is kept so far.
      for (const [k, v] of Object.entries(picks)) {
        const candidate = { ...next, [k]: v } as JsonRecord
        if (!introduces(candidate)) {
          next = candidate
          kept += 1
        }
      }
      if (kept) onChangeForm(next)
      const total = Object.keys(picks).length
      if (!kept) {
        notify(
          total === 1
            ? 'That suggestion no longer fits the other metadata, so it was not used.'
            : 'None of the suggestions fit the current metadata, so none were used.',
        )
      } else if (kept < total) {
        notify(
          `Used ${kept} of ${total} suggestions; the rest no longer fit the other fields.`,
        )
      }
    },
    [notify, onChangeForm, validateFull, value],
  )

  // Table view would drop drafts the form holds, so it waits for them
  const showView = (v: 'form' | 'table') => {
    if (v === 'table' && pending.length) {
      notify(`Finish or undo the edit to ${pendingLabel(pending)} first`)
      return
    }
    setView(v)
  }
  const [locked, setLocked] = React.useState(false)
  // an import replaces the metadata when it finishes, so nothing else edits it meanwhile
  const editLocked = disabled || locked

  // used to force json editor re-initialization
  const [jsonInlineEditorKey, setJsonInlineEditorKey] = React.useState(1)
  const [jsonFullscreenEditorKey, setJsonFullscreenEditorKey] = React.useState(1)

  const onDrop = React.useCallback(
    ([file]) => {
      if (!file) return
      if (file.size > MAX_META_FILE_SIZE) {
        notify(
          <>
            File too large ({readableBytes(file.size)}), must be under{' '}
            {readableBytes(MAX_META_FILE_SIZE)}.
          </>,
        )
        return
      }
      setLocked(true)
      setPending?.(IMPORT, true)
      readFile(file, schema)
        .then((contents) => {
          // guided metadata is one object; an array would be pushed with "0", "1"… keys
          const apply = (m: any) =>
            guided && (!m || typeof m !== 'object' || Array.isArray(m))
              ? notify('The file must hold one JSON object, not a list or a value')
              : onChange(m)
          if (typeof contents === 'object') {
            apply(contents)
          } else {
            try {
              const parsed = JSON.parse(contents as string)
              if (guided && hasLossyToken(contents as string)) {
                notify(
                  'The file has a number that cannot be stored exactly; use a string',
                )
              } else {
                apply(parsed)
              }
            } catch (e) {
              notify('The file does not contain valid JSON')
            }
            // FIXME: show error
          }
          // force json editor to re-initialize
          setJsonInlineEditorKey(R.inc)
          setJsonFullscreenEditorKey(R.inc)
        })
        .catch((e) => {
          if (e.message === 'abort') return
          // eslint-disable-next-line no-console
          console.log('Error reading file')
          // eslint-disable-next-line no-console
          console.error(e)
          notify("Couldn't read that file")
        })
        .finally(() => {
          setLocked(false)
          setPending?.(IMPORT, false)
        })
    },
    [
      schema,
      setLocked,
      setPending,
      guided,
      onChange,
      setJsonInlineEditorKey,
      setJsonFullscreenEditorKey,
      notify,
    ],
  )

  // guided: files live behind their own tab, so drags go there (Import file covers metadata)
  const isDragging = useDragging(!guided)

  const {
    getInputProps,
    getRootProps,
    isDragActive,
    open: openFile,
  } = useDropzone({
    onDrop,
    noClick: true,
    noDrag: guided,
    noKeyboard: true,
  })

  return (
    <div className={className}>
      {guided ? (
        // The pane's tab already names the section, so the toolbar holds only controls.
        <div className={classes.toolbar}>
          <Lab.ToggleButtonGroup
            aria-label="Metadata view"
            className={classes.viewToggle}
            exclusive
            onChange={(_e, v) => v && showView(v)}
            size="small"
            value={view}
          >
            <Lab.ToggleButton value="form" aria-label="Form view">
              <M.Icon fontSize="small">view_agenda</M.Icon>
              Form
            </Lab.ToggleButton>
            <Lab.ToggleButton value="table" aria-label="Table view">
              <M.Icon fontSize="small">table_rows</M.Icon>
              Table
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
          <div className={classes.toolbarActions}>
            <M.Button
              disabled={editLocked}
              onClick={openFile}
              size="small"
              startIcon={<M.Icon fontSize="small">upload_file</M.Icon>}
              title="Fill metadata from an XLSX, CSV or JSON file"
            >
              Import file
            </M.Button>
            <M.Button
              disabled={editLocked}
              onClick={openEditor}
              size="small"
              startIcon={<M.Icon fontSize="small">open_in_full</M.Icon>}
              title="Edit metadata in a full-screen editor"
            >
              Expand
            </M.Button>
          </div>
        </div>
      ) : (
        <div className={classes.header}>
          <M.Typography
            // eslint-disable-next-line no-nested-ternary
            color={disabled ? 'textSecondary' : errors.length ? 'error' : undefined}
          >
            Metadata
          </M.Typography>
          <M.Button
            className={classes.jsonTrigger}
            disabled={editLocked}
            onClick={openEditor}
            size="small"
            title="Expand JSON editor"
            variant="outlined"
            endIcon={
              <M.Icon fontSize="inherit" color="primary">
                fullscreen
              </M.Icon>
            }
          >
            Expand
          </M.Button>
        </div>
      )}

      <Dialog
        schema={schema}
        key={jsonFullscreenEditorKey}
        onChange={onChangeFullscreen}
        onClose={closeEditor}
        open={open}
        value={value}
      />

      {formView && hasForm && (
        <SuggestBar
          disabled={editLocked}
          onRequest={suggestions.request}
          onUseAll={() => {
            if (!suggested) return
            const brokenNow = invalidKeys(validateFull ? validateFull(value || {}) : [])
            applySuggestions(
              Object.fromEntries(
                Object.entries(suggested)
                  // a present value is kept unless the whole schema rejects it, so a null
                  // allowed through anyOf or $ref stays the user's choice
                  .filter(([k]) => !Object.hasOwn(value || {}, k) || brokenNow.has(k))
                  .map(([k, sg]) => [k, sg.value]),
              ),
            )
          }}
          state={suggestions.state}
          usable={Object.keys(suggested || {}).length}
        />
      )}
      {guided && !formView && (
        <RequiredFields blocked={blocked} errors={errors} schema={schema} value={value} />
      )}
      {guided && !formView && problems}

      <div
        {...getRootProps({
          className: cx(classes.dropzone, { [classes.dropzoneGuided]: guided }),
        })}
        tabIndex={undefined}
      >
        {guided && <input {...getInputProps()} />}
        <div className={classes.metaContent} ref={ref}>
          {isDragging && <div className={classes.outlined} />}

          {formView && (
            <>
              {hasForm && schema && (
                <MetaForm
                  disabled={editLocked}
                  // asterisks and the count already say a field is missing
                  errors={
                    insist
                      ? errors
                      : errors.filter(
                          (e) =>
                            !(
                              'keyword' in e &&
                              e.keyword === 'required' &&
                              !e.instancePath
                            ),
                        )
                  }
                  onChange={onChangeForm}
                  onShowTable={() => showView('table')}
                  onUseSuggestion={(k, v) => applySuggestions({ [k]: v })}
                  setPending={setPending}
                  schema={schema}
                  suggestions={suggested}
                  value={value}
                />
              )}
              <FreeFields
                description={
                  hasForm
                    ? 'Fields this workflow does not define. Add any that help describe the package.'
                    : 'Name/value pairs stored with this package and searchable in the catalog. Use Table view for nested values.'
                }
                disabled={editLocked}
                exclude={hasForm ? Object.keys(schema?.properties || {}) : []}
                onChange={onChangeForm}
                setPending={setPending}
                title={hasForm ? 'Other fields' : 'Metadata fields'}
                value={value}
              />
              {problems}
            </>
          )}
          {!formView && (
            <div className={classes.json}>
              <JsonEditor
                disabled={editLocked}
                errors={errors}
                key={jsonInlineEditorKey}
                // `disabled` only blocks the mouse in JsonEditor; keyboard edits are dropped here
                onChange={editLocked ? noop : onChangeInline}
                schema={schema}
                value={value}
              />
            </div>
          )}

          {!guided && problems}
        </div>

        {locked && (
          <div className={classes.overlay}>
            <M.Fade in style={{ transitionDelay: '500ms' }}>
              <div className={classes.overlayContents}>
                <M.CircularProgress size={20} className={classes.overlayProgress} />
                <div className={classes.overlayText}>Reading file contents</div>
              </div>
            </M.Fade>
          </div>
        )}

        {isDragging && (
          <div
            className={cx(classes.overlay, classes.overlayDraggable, {
              [classes.overlayDragActive]: isDragActive,
            })}
          >
            <div className={classes.overlayContents}>
              <div className={classes.overlayText}>
                Drop metadata file (XLSX, CSV, JSON)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

const useInputMetaStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

interface InputMetaProps {
  formStatus: FormStatus
  schema: SchemaStatus
  state: MetaState
  /** What metadata suggestions may draw on; none offered without it. */
  suggest?: SuggestContext
}

/**
 * Package metadata editor with drag-and-drop file support.
 *
 * Provides a JSON editor for package metadata with field-level error display
 * and can import from spreadsheet files (XLSX, CSV).
 */
export const MetaPane = React.forwardRef<HTMLDivElement, InputMetaProps>(
  function MetaPane(
    {
      formStatus,
      schema,
      state: { guided, pending, setPending, status, touched, value, warnings, onChange },
      suggest,
    },
    ref,
  ) {
    const classes = useInputMetaStyles()
    // Guided status is live, so it fails on a blank form; errors there wait for
    // an edit or a submit, while the required-fields list says what is missing.
    // Inherited metadata shows its errors at once: they are why Create is off.
    // a non-object root (null, false, a list) is an error to show, not a blank form
    const blank =
      value === undefined ||
      (typeof value === 'object' && value !== null && !Array.isArray(value)
        ? !Object.keys(value).length
        : false)
    const showErrors = !guided || touched || !blank || formStatus._tag === 'error'
    const errors = React.useMemo(() => {
      if (schema._tag === 'error') return [schema.error]
      if (status._tag !== 'error') return []
      if (showErrors) return status.errors
      // before any edit, a missing root field is already shown by its asterisk and the count
      const marked: unknown[] =
        schema._tag === 'ready' && Array.isArray(schema.schema?.required)
          ? schema.schema.required
          : []
      return status.errors.filter(
        (e) =>
          !(
            'keyword' in e &&
            e.keyword === 'required' &&
            !e.instancePath &&
            marked.includes(e.params?.missingProperty)
          ),
      )
    }, [schema, showErrors, status])
    if (schema._tag === 'loading') {
      return <MetaInputSkeleton ref={ref} className={classes.root} />
    }
    return (
      <MetaInput
        blocked={status._tag === 'error'}
        disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
        className={classes.root}
        errors={errors}
        guided={guided}
        onChange={onChange}
        ref={ref}
        schema={schema._tag === 'ready' ? schema.schema : undefined}
        insist={touched || formStatus._tag === 'error'}
        pending={pending}
        setPending={setPending}
        suggest={suggest}
        value={value}
        warnings={showErrors ? warnings : []}
      />
    )
  },
)

/**
 * Set by a dialog that shows guided metadata in its own pane: the inline slot
 * then shows a summary that opens that pane instead of a second editor.
 */
export const MetaPaneOpener = React.createContext<(() => void) | null>(null)

const InputMeta = React.forwardRef<HTMLDivElement, InputMetaProps>(
  function InputMeta(props, ref) {
    const openPane = React.useContext(MetaPaneOpener)
    if (props.state.guided && openPane) {
      return <MetaSummary onOpen={openPane} schema={props.schema} state={props.state} />
    }
    return <MetaPane {...props} ref={ref} />
  },
)

export default InputMeta

import cx from 'classnames'
import mime from 'mime-types'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as M from '@material-ui/core'

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
import type { SchemaStatus } from '../State/schema'
import type { MetaState } from '../State/meta'
import { MetaInputSkeleton } from '../Skeleton'

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

interface MetaInputProps {
  className?: string
  errors: ValidationErrors
  value: JsonRecord | undefined
  onChange: (value: JsonRecord) => void
  schema?: JsonSchema
  disabled: boolean
}

const MetaInput = React.forwardRef<HTMLDivElement, MetaInputProps>(function MetaInput(
  { className, disabled, errors, value, onChange, schema },
  ref,
) {
  const classes = useMetaInputStyles()

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

  const { push: notify } = Notifications.use()
  const [locked, setLocked] = React.useState(false)

  // used to force json editor re-initialization
  const [jsonInlineEditorKey, setJsonInlineEditorKey] = React.useState(1)
  const [jsonFullscreenEditorKey, setJsonFullscreenEditorKey] = React.useState(1)

  const onDrop = React.useCallback(
    ([file]) => {
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
      readFile(file, schema)
        .then((contents) => {
          if (typeof contents === 'object') {
            onChange(contents)
          } else {
            try {
              onChange(JSON.parse(contents as string))
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
        })
    },
    [
      schema,
      setLocked,
      onChange,
      setJsonInlineEditorKey,
      setJsonFullscreenEditorKey,
      notify,
    ],
  )

  const isDragging = useDragging()

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <div className={className}>
      <div className={classes.header}>
        <M.Typography
          // eslint-disable-next-line no-nested-ternary
          color={disabled ? 'textSecondary' : errors.length ? 'error' : undefined}
        >
          Metadata
        </M.Typography>
        <M.Button
          className={classes.jsonTrigger}
          disabled={disabled}
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

      <Dialog
        schema={schema}
        key={jsonFullscreenEditorKey}
        onChange={onChangeFullscreen}
        onClose={closeEditor}
        open={open}
        value={value}
      />

      <div {...getRootProps({ className: classes.dropzone })} tabIndex={undefined}>
        <div className={classes.metaContent} ref={ref}>
          {isDragging && <div className={classes.outlined} />}

          <div className={classes.json}>
            <JsonEditor
              disabled={disabled}
              errors={errors}
              key={jsonInlineEditorKey}
              onChange={onChangeInline}
              schema={schema}
              value={value}
            />
          </div>

          <JsonValidationErrors className={classes.errors} error={errors} />
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
}

/**
 * Package metadata editor with drag-and-drop file support.
 *
 * Provides a JSON editor for package metadata with field-level error display
 * and can import from spreadsheet files (XLSX, CSV).
 */
const InputMeta = React.forwardRef<HTMLDivElement, InputMetaProps>(function InputMeta(
  { formStatus, schema, state: { status, value, onChange } },
  ref,
) {
  const classes = useInputMetaStyles()
  const errors = React.useMemo(() => {
    if (schema._tag === 'error') return [schema.error]
    if (status._tag === 'error') return status.errors
    return []
  }, [schema, status])
  if (schema._tag === 'loading') {
    return <MetaInputSkeleton ref={ref} className={classes.root} />
  }
  return (
    <MetaInput
      disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
      className={classes.root}
      errors={errors}
      onChange={onChange}
      ref={ref}
      schema={schema._tag === 'ready' ? schema.schema : undefined}
      value={value}
    />
  )
})

export default InputMeta

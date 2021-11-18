import cx from 'classnames'
import mime from 'mime-types'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import type * as RF from 'react-final-form'
import { fade } from '@material-ui/core/styles'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'
import { JsonValue } from 'components/JsonEditor/constants'
import JsonValidationErrors from 'components/JsonValidationErrors'
import MetadataEditor from 'components/MetadataEditor'
import * as Notifications from 'containers/Notifications'
import Delay from 'utils/Delay'
import useDragging from 'utils/dragging'
import { JsonSchema } from 'utils/json-schema'
import * as spreadsheets from 'utils/spreadsheets'
import { readableBytes } from 'utils/string'
import { JsonRecord } from 'utils/types'

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
          label="Edit raw data"
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

const readFile = (file: File, schema?: JsonSchema): Promise<string | {}> => {
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
    background: fade(t.palette.grey[200], 0.8),
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

export const EMPTY_META_VALUE = {}

interface MetaInputProps {
  className?: string
  schemaError: React.ReactNode
  input: RF.FieldInputProps<{}>
  meta: RF.FieldMetaState<{}>
  schema?: JsonSchema
}

// FIXME: disabled state
export const MetaInput = React.forwardRef<HTMLDivElement, MetaInputProps>(
  function MetaInput(
    { className, schemaError, input: { value, onChange }, meta, schema },
    ref,
  ) {
    const classes = useMetaInputStyles()
    const error = schemaError || ((meta.modified || meta.submitFailed) && meta.error)
    const disabled = meta.submitting || meta.submitSucceeded

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
          .then((contents: string | {}) => {
            if (R.is(Object, contents)) {
              onChange(contents)
            } else {
              try {
                JSON.parse(contents as string)
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

    const { getRootProps, isDragActive } = useDropzone({ onDrop })

    return (
      <div className={className}>
        <div className={classes.header}>
          {/* eslint-disable-next-line no-nested-ternary */}
          <M.Typography color={disabled ? 'textSecondary' : error ? 'error' : undefined}>
            Metadata
          </M.Typography>
          <M.Button
            className={classes.jsonTrigger}
            onClick={openEditor}
            title="Edit meta"
            size="small"
            variant="outlined"
            endIcon={
              <M.Icon fontSize="inherit" color="primary">
                fullscreen
              </M.Icon>
            }
          >
            Edit
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
                key={jsonInlineEditorKey}
                value={value}
                onChange={onChangeInline}
                schema={schema}
              />
            </div>

            <JsonValidationErrors className={classes.errors} error={error} />
          </div>

          {locked && (
            <div className={classes.overlay}>
              <Delay ms={500} alwaysRender>
                {(ready) => (
                  <M.Fade in={ready}>
                    <div className={classes.overlayContents}>
                      <M.CircularProgress size={20} className={classes.overlayProgress} />
                      <div className={classes.overlayText}>Reading file contents</div>
                    </div>
                  </M.Fade>
                )}
              </Delay>
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
  },
)

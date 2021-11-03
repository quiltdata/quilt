import cx from 'classnames'
import mime from 'mime-types'
import * as R from 'ramda'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import type * as RF from 'react-final-form'
import { fade } from '@material-ui/core/styles'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

// import JsonDisplay from 'components/JsonDisplay'
import JsonEditor from 'components/JsonEditor'
import { parseJSON, stringifyJSON } from 'components/JsonEditor/utils'
import * as Notifications from 'containers/Notifications'
import Delay from 'utils/Delay'
import useDragging from 'utils/dragging'
import { JsonSchema } from 'utils/json-schema'
import * as spreadsheets from 'utils/spreadsheets'
import { readableBytes } from 'utils/string'

import MetaInputErrorHelper from './MetaInputErrorHelper'

const MAX_META_FILE_SIZE = 10 * 1000 * 1000 // 10MB

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
  jsonInput: {
    fontFamily: (t.typography as any).monospace.fontFamily,
    '&::placeholder': {
      fontFamily: t.typography.fontFamily,
    },
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
  jsonDisplay: {
    margin: t.spacing(1, 2, 0, 0),
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
  editor: {
    overflowY: 'auto',
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

type Mode = 'kv' | 'json'

// TODO: warn on duplicate keys
export const MetaInput = React.forwardRef<HTMLDivElement, MetaInputProps>(
  function MetaInput(
    { className, schemaError, input: { value, onChange }, meta, schema },
    ref,
  ) {
    const classes = useMetaInputStyles()
    const error = schemaError || ((meta.modified || meta.submitFailed) && meta.error)
    const disabled = meta.submitting || meta.submitSucceeded
    const [mode, setMode] = React.useState<Mode>('kv')

    const [textValue, setTextValue] = React.useState(() => stringifyJSON(value))

    const changeText = React.useCallback(
      (text) => {
        if (disabled) return
        setTextValue(text)
        onChange(parseJSON(text))
      },
      [disabled, onChange],
    )

    const handleModeChange = (_e: unknown, m: Mode) => {
      if (!m) return
      setMode(m)
    }

    const handleTextChange = (e: React.ChangeEvent<{ value: string }>) => {
      changeText(e.target.value)
    }

    const onJsonEditor = React.useCallback(
      (json: {}) => {
        setTextValue(stringifyJSON(json))
        onChange(json)
      },
      [onChange],
    )

    const { push: notify } = Notifications.use()
    const [locked, setLocked] = React.useState(false)

    // used to force json editor re-initialization
    const [jsonEditorKey, setJsonEditorKey] = React.useState(1)

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
              onJsonEditor(contents)
            } else {
              try {
                JSON.parse(contents as string)
              } catch (e) {
                notify('The file does not contain valid JSON')
              }
              changeText(contents)
            }
            // force json editor to re-initialize
            setJsonEditorKey(R.inc)
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
      [schema, setLocked, changeText, onJsonEditor, setJsonEditorKey, notify],
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

          <M.Box flexGrow={1} />
          <Lab.ToggleButtonGroup value={mode} exclusive onChange={handleModeChange}>
            <Lab.ToggleButton value="kv" className={classes.btn} disabled={disabled}>
              Key : Value
            </Lab.ToggleButton>
            <Lab.ToggleButton value="json" className={classes.btn} disabled={disabled}>
              JSON
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
        </div>

        <div {...getRootProps({ className: classes.dropzone })} tabIndex={undefined}>
          {isDragging && <div className={classes.outlined} />}

          {/* <div className={classes.json}>
            <JsonDisplay
              name=""
              topLevel={1}
              value={value}
              className={classes.jsonDisplay}
              defaultExpanded={1}
            />
            <M.Button
              className={classes.jsonTrigger}
              title="Edit meta"
              variant="outlined"
              startIcon={
                <M.Icon fontSize="inherit" color="primary">
                  list
                </M.Icon>
              }
            >
              Edit
            </M.Button>
          </div> */}

          {mode === 'kv' ? (
            <JsonEditor
              className={classes.editor}
              disabled={disabled}
              value={value}
              onChange={onJsonEditor}
              schema={schema}
              key={jsonEditorKey}
              ref={ref}
            />
          ) : (
            <M.TextField
              variant="outlined"
              size="small"
              value={textValue}
              onChange={handleTextChange}
              error={!!error}
              fullWidth
              multiline
              placeholder="Enter JSON metadata if necessary"
              rowsMax={10}
              InputProps={{ classes: { input: classes.jsonInput } }}
              disabled={disabled}
            />
          )}

          <MetaInputErrorHelper className={classes.errors} error={error} />

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

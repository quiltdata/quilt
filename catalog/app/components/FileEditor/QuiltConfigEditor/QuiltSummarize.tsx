import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

import type * as Summarize from 'components/Preview/loaders/summarize'

// import { docs } from 'constants/urls'
// import StyledLink from 'utils/StyledLink'

import type { QuiltConfigEditorProps } from './QuiltConfigEditor'

interface FileExtended extends Omit<Summarize.FileExtended, 'types'> {
  isExtended: boolean
  type?: Summarize.TypeExtended
}

type Row = FileExtended[]

type Layout = Row[]

const emptyFile: FileExtended = { path: '', isExtended: false }

const init = (payload?: Layout) => (): Layout => payload || [[emptyFile]]

const addRow = (layout: Layout): Layout => [...layout, [emptyFile]]

const addColumn =
  (rowIndex: number) =>
  (file: FileExtended) =>
  (layout: Layout): Layout =>
    layout.toSpliced(rowIndex, 1, [...layout[rowIndex], file])

const changeValue =
  (rowIndex: number, columnIndex: number) =>
  (file: FileExtended) =>
  (layout: Layout): Layout =>
    layout.toSpliced(rowIndex, 1, layout[rowIndex].toSpliced(columnIndex, 1, file))

function parseFile(fileOrPath: Summarize.File): FileExtended {
  if (typeof fileOrPath === 'string') return { path: fileOrPath, isExtended: false }
  const { types, ...file } = fileOrPath
  if (!types || !types.length) return { ...fileOrPath, isExtended: true }
  return {
    ...file,
    isExtended: true,
    type: typeof types[0] === 'string' ? { name: types[0] } : types[0],
  }
}

function parse(str: string): Layout {
  const permissive = JSON.parse(str)
  // TODO: validate with JSON Schema
  if (!permissive) return []
  if (!Array.isArray(permissive)) throw new Error('Expected array')
  return permissive.map((row) =>
    Array.isArray(row) ? row.map(parseFile) : [parseFile(row)],
  )
}

function stringify(layout: Layout) {
  // TODO: validate with JSON Schema
  return JSON.stringify(
    layout.map((row) => {
      const columns = row.map((file) =>
        Object.keys(file).length === 1 && file.path ? file.path : file,
      )
      return columns.length === 1 ? columns[0] : columns
    }),
  )
}

const useAddFileStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    animation: '$show 0.15s ease-out',
  },
  settings: {
    marginRight: t.spacing(1),
  },
  extended: {
    animation: '$slide 0.15s ease-out',
    paddingLeft: t.spacing(7),
    display: 'flex',
    flexDirection: 'column',
  },
  expanded: {
    position: 'absolute',
    right: '16px',
    top: '4px',
  },
  path: {
    display: 'flex',
    alignItems: 'center',
  },
  field: {
    marginTop: t.spacing(1),
  },
  render: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(2),
    padding: t.spacing(2),
  },
  toggle: {
    padding: t.spacing(1, 0, 0),
  },
  '@keyframes slide': {
    from: {
      opacity: 0,
      transform: 'translateY(-8px)',
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
  '@keyframes show': {
    from: {
      opacity: 0,
      transform: 'scale(0.9)',
    },
    to: {
      opacity: 1,
      transform: 'scale(1)',
    },
  },
}))

interface AddFileProps {
  className: string
  disabled?: boolean
  file: FileExtended
  onChange: (file: FileExtended) => void
  single: boolean
}

function AddFile({ className, disabled, file, onChange, single }: AddFileProps) {
  const classes = useAddFileStyles()
  // TODO: simple mode instead of advanced
  //       save to simple entered fields, and restore them
  const [advanced, setAdvanced] = React.useState(file.isExtended)
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.path}>
        <M.IconButton
          className={classes.settings}
          onClick={() => setAdvanced((a) => !a)}
          color={advanced ? 'primary' : 'default'}
        >
          <M.Icon>settings</M.Icon>
        </M.IconButton>
        <M.TextField
          disabled={disabled}
          label="Path"
          name="path"
          onChange={(event) => onChange({ ...file, path: event.currentTarget.value })}
          value={file.path}
          fullWidth
        />
      </div>
      {advanced && (
        <div className={classes.extended}>
          <M.TextField
            disabled={disabled}
            label="Title"
            name="title"
            onChange={(event) => onChange({ ...file, title: event.currentTarget.value })}
            value={file.title}
            fullWidth
            className={classes.field}
            size="small"
          />
          <M.TextField
            disabled={disabled}
            label="Description"
            name="description"
            onChange={(event) =>
              onChange({ ...file, description: event.currentTarget.value })
            }
            value={file.description}
            fullWidth
            className={classes.field}
            size="small"
          />

          <M.FormControl className={classes.render}>
            <M.FormLabel>Preview</M.FormLabel>
            <M.FormControlLabel
              className={classes.expanded}
              control={
                <M.Checkbox
                  checked={file.expand}
                  onChange={(_e, expand) => onChange({ ...file, expand })}
                  size="small"
                />
              }
              labelPlacement="start"
              label="Expanded"
            />
            <M.FormGroup>
              {!single && (
                <M.TextField
                  disabled={disabled}
                  label="Width"
                  name="width"
                  onChange={(event) =>
                    onChange({ ...file, width: event.currentTarget.value })
                  }
                  value={file.width}
                  fullWidth
                  className={classes.field}
                  size="small"
                />
              )}

              <M.FormControl className={classes.field} fullWidth size="small">
                <M.InputLabel>Renderer</M.InputLabel>
                <M.Select
                  displayEmpty
                  value={file.type?.name || ''}
                  onChange={(event) =>
                    onChange({
                      ...file,
                      type: {
                        ...(file.type || {}),
                        name: event.target.value as Summarize.TypeShorthand,
                      },
                    })
                  }
                >
                  <M.MenuItem value="">
                    <i>Default</i>
                  </M.MenuItem>
                  {quiltSummarizeSchema.definitions.typeShorthand.enum.map((type) => (
                    <M.MenuItem key={type} value={type}>
                      {type}
                    </M.MenuItem>
                  ))}
                </M.Select>
              </M.FormControl>

              {file.type && (
                <M.TextField
                  disabled={disabled}
                  label="Height"
                  name="height"
                  onChange={(event) =>
                    onChange({
                      ...file,
                      type: {
                        ...((file.type || {}) as Summarize.TypeExtended),
                        style: { height: event.currentTarget.value },
                      },
                    })
                  }
                  value={file.type.style?.height}
                  fullWidth
                  className={classes.field}
                  size="small"
                />
              )}

              {file.type?.name === 'perspective' && (
                <M.TextField
                  disabled={disabled}
                  label="Perspective config"
                  name="config"
                  onChange={(event) =>
                    onChange({
                      ...file,
                      type: {
                        ...((file.type || {}) as Summarize.TypeExtended),
                        config: JSON.parse(event.currentTarget.value),
                      },
                    })
                  }
                  value={file.type.config}
                  fullWidth
                  className={classes.field}
                  size="small"
                />
              )}

              {file.type?.name === 'perspective' && (
                <M.FormControlLabel
                  control={
                    <M.Checkbox
                      onChange={(_e, checked) =>
                        onChange({
                          ...file,
                          type: {
                            ...((file.type || {}) as Summarize.TypeExtended),
                            settings: checked,
                          },
                        })
                      }
                      checked={file.type.settings}
                      size="small"
                    />
                  }
                  label="Show perspective toolbar"
                  className={cx(classes.field, classes.toggle)}
                />
              )}
            </M.FormGroup>
          </M.FormControl>
        </div>
      )}
    </div>
  )
}

const usePlaceholderStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    backgroundColor: t.palette.divider,
    borderRadius: t.shape.borderRadius,
    color: t.palette.background.paper,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    justifyContent: 'center',
    opacity: 0.7,
    outline: `2px dashed ${t.palette.background.paper}`,
    outlineOffset: '-4px',
    '&:hover': {
      opacity: 1,
    },
  },
  disabled: {
    cursor: 'not-allowed',
    opacity: 0.3,
    '&:hover': {
      opacity: 0.3,
    },
  },
}))
interface PlaceholderProps {
  disabled?: boolean
  className: string
  onClick: () => void
}

function Placeholder({ disabled, className, onClick }: PlaceholderProps) {
  const classes = usePlaceholderStyles()
  return (
    <div
      className={cx(classes.root, disabled && classes.disabled, className)}
      onClick={onClick}
    >
      <M.Icon>add</M.Icon>
    </div>
  )
}

const useAddRowStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
  },
  add: {
    marginLeft: t.spacing(4),
    width: t.spacing(10),
  },
  column: {
    flexGrow: 1,
    '& + &': {
      marginLeft: t.spacing(4),
      paddingLeft: t.spacing(2),
      borderLeft: `2px dashed ${t.palette.divider}`,
    },
  },
}))

interface AddRowProps {
  className: string
  disabled?: boolean
  onAddColumn: (file: FileExtended) => void
  onChange: (columnIndex: number) => (file: FileExtended) => void
  row: Row
}

function AddRow({ className, disabled, row, onChange, onAddColumn }: AddRowProps) {
  const classes = useAddRowStyles()
  return (
    <div className={cx(classes.root, className)}>
      {row.map((file, j) => (
        <AddFile
          className={classes.column}
          key={j}
          file={file}
          onChange={onChange(j)}
          disabled={disabled}
          single={row.length === 1}
        />
      ))}
      <Placeholder
        className={classes.add}
        onClick={() => onAddColumn(emptyFile)}
        disabled={disabled}
      />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    '& + & ': {
      marginTop: t.spacing(4),
      paddingTop: t.spacing(4),
      borderTop: `2px dashed ${t.palette.divider}`,
    },
  },
  add: {
    height: t.spacing(8),
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
}))

export default function QuiltSummarize({
  className,
  disabled,
  error,
  initialValue,
  onChange,
}: QuiltConfigEditorProps) {
  const classes = useStyles()
  const [layout, setLayout] = React.useState<Layout>(init())

  React.useEffect(() => {
    if (!initialValue) return
    try {
      setLayout(init(parse(initialValue)))
    } catch (e) {
      setState(e instanceof Error ? e : new Error(`${e}`))
    }
  }, [initialValue])

  const [state, setState] = React.useState<Error | null>(error)
  const handleSubmit = React.useCallback(() => {
    try {
      const summarize = stringify(layout)
      onChange(summarize)
    } catch (e) {
      setState(e instanceof Error ? e : new Error(`${e}`))
    }
  }, [layout, onChange])

  const onAddColumn = React.useMemo(
    () => (rowIndex: number) => {
      const dispatch = addColumn(rowIndex)
      return (f: FileExtended) => setLayout(dispatch(f))
    },
    [],
  )

  const onChangeValue = React.useMemo(
    () => (rowIndex: number) => (columnIndex: number) => {
      const dispatch = changeValue(rowIndex, columnIndex)
      return (f: FileExtended) => setLayout(dispatch(f))
    },
    [],
  )

  const onAddRow = React.useCallback(() => {
    setLayout(addRow)
  }, [])

  return (
    <div className={cx(classes.root, className)}>
      {state instanceof Error ? (
        <M.Typography color="error">{state.message}</M.Typography>
      ) : null}

      {layout.map((row, i) => (
        <AddRow
          className={classes.row}
          row={row}
          key={i}
          onAddColumn={onAddColumn(i)}
          onChange={onChangeValue(i)}
          disabled={disabled}
        />
      ))}

      <div className={classes.row}>
        <Placeholder className={classes.add} onClick={onAddRow} disabled={disabled} />
      </div>

      <div className={classes.actions}>
        <M.Button onClick={handleSubmit} disabled={disabled}>
          Submit
        </M.Button>
      </div>
    </div>
  )
}

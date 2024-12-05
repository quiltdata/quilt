import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

import type * as Summarize from 'components/Preview/loaders/summarize'

// TODO: link to docs
// import { docs } from 'constants/urls'
// import StyledLink from 'utils/StyledLink'

// TODO: remove column, remove row
//       add column in-between, add row in-between

import type { QuiltConfigEditorProps } from './QuiltConfigEditor'

interface FileExtended extends Omit<Summarize.FileExtended, 'types'> {
  isExtended: boolean
  type?: Summarize.TypeExtended
}

interface Column {
  id: number
  file: FileExtended
}

interface Row {
  id: number
  columns: Column[]
}

interface Layout {
  rows: Row[]
}

const emptyFile: FileExtended = { path: '', isExtended: false }

const createRow = (id: number, file: FileExtended): Row => ({
  id,
  columns: [{ id: 0, file }],
})

// const createColumn TODO

const init = (payload?: Layout) => (): Layout =>
  payload || {
    rows: [createRow(0, emptyFile)],
  }

const addRow = (layout: Layout): Layout => ({
  rows: [...layout.rows, createRow(layout.rows.length + 1, emptyFile)],
})

const addColumn =
  (rowIndex: number) =>
  (file: FileExtended) =>
  (layout: Layout): Layout => ({
    rows: layout.rows.toSpliced(rowIndex, 1, {
      id: rowIndex,
      columns: [
        ...layout.rows[rowIndex].columns,
        { id: layout.rows[rowIndex].columns.length, file },
      ],
    }),
  })

const changeValue =
  (rowIndex: number, columnIndex: number) =>
  (file: FileExtended) =>
  (layout: Layout): Layout => ({
    rows: layout.rows.toSpliced(rowIndex, 1, {
      id: rowIndex,
      columns: layout.rows[rowIndex].columns.toSpliced(columnIndex, 1, {
        id: columnIndex,
        file,
      }),
    }),
  })

function parseColumn(fileOrPath: Summarize.File, id: number): Column {
  if (typeof fileOrPath === 'string')
    return { id, file: { path: fileOrPath, isExtended: false } }
  const { types, ...file } = fileOrPath
  if (!types || !types.length) return { id, file: { ...fileOrPath, isExtended: true } }
  return {
    id,
    file: {
      ...file,
      isExtended: true,
      type: typeof types[0] === 'string' ? { name: types[0] } : types[0],
    },
  }
}

function parse(str: string): Layout {
  const permissive = JSON.parse(str)
  // TODO: validate with JSON Schema
  if (!permissive) return { rows: [] }
  if (!Array.isArray(permissive)) throw new Error('Expected array')
  return {
    rows: permissive.map((row, index) => ({
      id: index,
      columns: Array.isArray(row) ? row.map(parseColumn) : [parseColumn(row, 0)],
    })),
  }
}

function stringify(layout: Layout) {
  // TODO: validate with JSON Schema
  return JSON.stringify(
    layout.rows.map((row) => {
      const columns = row.columns.map(({ file }) =>
        Object.keys(file).length === 1 && file.path ? file.path : file,
      )
      return columns.length === 1 ? columns[0] : columns
    }),
  )
}

const useAddColumnStyles = M.makeStyles((t) => ({
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

interface AddColumnProps {
  className: string
  column: Column
  disabled?: boolean
  onChange: React.Dispatch<React.SetStateAction<Layout>>
  row: Row
}

function AddColumn({ className, column, disabled, onChange, row }: AddColumnProps) {
  const classes = useAddColumnStyles()
  const { file } = column
  // TODO: simple mode instead of advanced
  //       save to simple entered fields, and restore them
  const [advanced, setAdvanced] = React.useState(file.isExtended)

  const onChangeValue = React.useCallback(
    (key: keyof FileExtended, value: FileExtended[keyof FileExtended]) => {
      const dispatch = changeValue(row.id, column.id)
      onChange(dispatch({ ...file, [key]: value }))
    },
    [onChange, row.id, column.id, file],
  )

  const onChangeType = React.useCallback(
    (
      key: keyof Summarize.TypeExtended,
      value: Summarize.TypeExtended[keyof Summarize.TypeExtended],
    ) => {
      onChangeValue('type', {
        ...((file.type || {}) as Summarize.TypeExtended),
        [key]: value,
      })
    },
    [onChangeValue, file],
  )

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
          onChange={(event) => onChangeValue('path', event.currentTarget.value)}
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
            onChange={(event) => onChangeValue('title', event.currentTarget.value)}
            value={file.title}
            fullWidth
            className={classes.field}
            size="small"
          />
          <M.TextField
            disabled={disabled}
            label="Description"
            name="description"
            onChange={(event) => onChangeValue('description', event.currentTarget.value)}
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
                  checked={file.expand || false}
                  onChange={(_e, expand) => onChangeValue('expand', expand)}
                  size="small"
                />
              }
              labelPlacement="start"
              label="Expanded"
            />
            <M.FormGroup>
              {row.columns.length > 1 && (
                <M.TextField
                  disabled={disabled}
                  label="Width"
                  name="width"
                  onChange={(event) => onChangeValue('width', event.currentTarget.value)}
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
                    onChangeType('name', event.target.value as Summarize.TypeShorthand)
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
                    onChangeType('style', { height: event.currentTarget.value })
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
                    onChangeType('config', JSON.parse(event.currentTarget.value))
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
                      onChange={(_e, checked) => onChangeType('settings', checked)}
                      checked={file.type.settings || false}
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
  row: Row
  onChange: React.Dispatch<React.SetStateAction<Layout>>
}

function AddRow({ onChange, className, disabled, row }: AddRowProps) {
  const classes = useAddRowStyles()

  const onAddColumn = React.useCallback(
    () => onChange(addColumn(row.id)(emptyFile)),
    [row.id, onChange],
  )

  return (
    <div className={cx(classes.root, className)}>
      {row.columns.map((column) => (
        <AddColumn
          className={classes.column}
          key={column.id}
          row={row}
          column={column}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
      <Placeholder className={classes.add} onClick={onAddColumn} disabled={disabled} />
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

  const onAddRow = React.useCallback(() => setLayout(addRow), [])

  return (
    <div className={cx(classes.root, className)}>
      {state instanceof Error ? (
        <M.Typography color="error">{state.message}</M.Typography>
      ) : null}

      {layout.rows.map((row) => (
        <AddRow
          className={classes.row}
          disabled={disabled}
          key={row.id}
          row={row}
          onChange={setLayout}
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

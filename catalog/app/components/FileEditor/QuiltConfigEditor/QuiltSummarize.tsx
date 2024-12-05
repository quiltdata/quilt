import cx from 'classnames'
import * as React from 'react'
import { nanoid } from 'nanoid'
import * as M from '@material-ui/core'

import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

import type * as Summarize from 'components/Preview/loaders/summarize'

// TODO: link to docs
// import { docs } from 'constants/urls'
// import StyledLink from 'utils/StyledLink'

// TODO: remove column, remove row

import type { QuiltConfigEditorProps } from './QuiltConfigEditor'

interface FileExtended extends Omit<Summarize.FileExtended, 'types'> {
  isExtended: boolean
  type?: Summarize.TypeExtended
}

interface Column {
  id: string
  file: FileExtended
}

interface Row {
  id: string
  columns: Column[]
}

interface Layout {
  rows: Row[]
}

const pathToFile = (path: string): FileExtended => ({ path, isExtended: false })

const emptyFile: FileExtended = pathToFile('')

const createColumn = (file: FileExtended): Column => ({
  id: nanoid(2),
  file,
})

const createRow = (file: FileExtended): Row => ({
  id: nanoid(2),
  columns: [createColumn(file)],
})

const init = (payload?: Layout) => (): Layout =>
  payload || {
    rows: [createRow(emptyFile)],
  }

function insert<T>(array: T[], index: number, item: T): T[] {
  return array.toSpliced(index, 0, item)
}

function insertAfter<T extends { id: string }>(array: T[], id: string, item: T): T[] {
  const index = array.findIndex((r) => r.id === id)
  return insert(array, index + 1, item)
}

type Callback<T> = (item: T) => T
function replace<T extends { id: string }>(array: T[], id: string, cb: Callback<T>): T[] {
  const index = array.findIndex((r) => r.id === id)
  return array.toSpliced(index, 1, cb(array[index]))
}

const addRowAfter =
  (rowId: string) =>
  (layout: Layout): Layout => ({
    rows: insertAfter(layout.rows, rowId, createRow(emptyFile)),
  })

const addColumn =
  (rowId: string, columnId: string) =>
  (file: FileExtended) =>
  (layout: Layout): Layout => ({
    rows: replace(layout.rows, rowId, (row) => ({
      ...row,
      columns: insertAfter(row.columns, columnId, createColumn(file)),
    })),
  })

const changeValue =
  (rowId: string, columnId: string) =>
  (file: FileExtended) =>
  (layout: Layout): Layout => ({
    rows: replace(layout.rows, rowId, (row) => ({
      ...row,
      columns: replace(row.columns, columnId, (column) => ({
        ...column,
        file,
      })),
    })),
  })

function parseColumn(fileOrPath: Summarize.File): Column {
  if (typeof fileOrPath === 'string') {
    return createColumn(pathToFile(fileOrPath))
  }
  const { types, ...file } = fileOrPath
  if (!types || !types.length) return createColumn({ ...fileOrPath, isExtended: true })
  return createColumn({
    ...file,
    isExtended: true,
    type: typeof types[0] === 'string' ? { name: types[0] } : types[0],
  })
}

function parse(str: string): Layout {
  const permissive = JSON.parse(str)
  // TODO: validate with JSON Schema
  if (!permissive) return { rows: [] }
  if (!Array.isArray(permissive)) throw new Error('Expected array')
  return {
    rows: permissive.map((row) => ({
      id: nanoid(2),
      columns: Array.isArray(row) ? row.map(parseColumn) : [parseColumn(row)],
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
    animation: '$show 0.15s ease-out',
    display: 'flex',
  },
  inner: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
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
  divider: {
    marginLeft: t.spacing(4),
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
  last: boolean
}

function AddColumn({ className, column, disabled, last, onChange, row }: AddColumnProps) {
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
      <div className={classes.inner}>
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
              onChange={(event) =>
                onChangeValue('description', event.currentTarget.value)
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
                    onChange={(event) =>
                      onChangeValue('width', event.currentTarget.value)
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
      <Placeholder
        className={classes.divider}
        disabled={disabled}
        expanded={last}
        onClick={() => onChange(addColumn(row.id, column.id)(emptyFile))}
        variant="vertical"
      />
    </div>
  )
}

const usePlaceholderStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(4),
    position: 'relative',
    '&:hover:not($expanded):not($disabled) $inner': {
      outlineOffset: '-4px',
    },
    '&:hover:not($expanded):not($disabled) $icon': {
      display: 'block',
    },
    '&$horizontal:hover:not($expanded):not($disabled) $inner': {
      left: 0,
      right: 0,
      top: t.spacing(2),
      bottom: t.spacing(2),
    },
    '&$vertical:hover:not($expanded):not($disabled) $inner': {
      top: 0,
      bottom: 0,
      left: t.spacing(2),
      right: t.spacing(2),
    },
  },
  expanded: {},
  disabled: {},
  icon: {
    display: 'none',
    '$expanded &': {
      display: 'block',
    },
  },
  inner: {
    background: t.palette.divider,
    borderRadius: t.shape.borderRadius,
    outline: `2px dashed ${t.palette.background.paper}`,
    outlineOffset: '-2px',
    position: 'absolute',
    transition:
      'top 0.15s ease-out, bottom 0.15s ease-out,left 0.15s ease-out, right 0.15s ease-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: t.palette.background.paper,
    cursor: 'pointer',
    '$vertical$expanded &': {
      top: 0,
      bottom: 0,
      outlineOffset: '-4px',
      left: 0,
      right: 0,
    },
    '$horizontal$expanded &': {
      top: t.spacing(2),
      bottom: t.spacing(2),
      outlineOffset: '-4px',
      left: 0,
      right: 0,
    },
    '$horizontal &': {
      bottom: `calc(${t.spacing(4)}px - 1px)`,
      left: `calc(${t.spacing(4)}px - 1px)`,
      right: `calc(${t.spacing(4)}px - 1px)`,
      top: `calc(${t.spacing(4)}px - 1px)`,
    },
    '$vertical &': {
      bottom: 0,
      left: `calc(${t.spacing(4)}px - 1px)`,
      right: `calc(${t.spacing(4)}px - 1px)`,
      top: 0,
    },
  },
  horizontal: {},
  vertical: {},
}))

interface PlaceholderProps {
  className?: string
  onClick: () => void
  disabled?: boolean
  expanded: boolean
  variant: 'horizontal' | 'vertical'
}

function Placeholder({
  className,
  expanded,
  disabled,
  onClick,
  variant,
}: PlaceholderProps) {
  const classes = usePlaceholderStyles()
  return (
    <div
      className={cx(
        classes.root,
        expanded && classes.expanded,
        disabled && classes.disabled,
        variant === 'horizontal' && classes.horizontal,
        variant === 'vertical' && classes.vertical,
        className,
      )}
    >
      <div className={classes.inner} onClick={onClick}>
        <M.Icon color="inherit" className={classes.icon}>
          add
        </M.Icon>
      </div>
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
  },
  divider: {
    marginTop: t.spacing(2),
  },
}))

interface AddRowProps {
  disabled?: boolean
  row: Row
  onAdd: (row: Row) => void
  onChange: React.Dispatch<React.SetStateAction<Layout>>
  last: boolean
}

function AddRow({ onAdd, onChange, disabled, row, last }: AddRowProps) {
  const classes = useAddRowStyles()

  return (
    <div>
      <div className={classes.root}>
        {row.columns.map((column, index) => (
          <AddColumn
            className={classes.column}
            key={column.id}
            row={row}
            column={column}
            onChange={onChange}
            disabled={disabled}
            last={index === row.columns.length - 1}
          />
        ))}
      </div>
      <Placeholder
        variant="horizontal"
        className={classes.divider}
        expanded={last}
        onClick={() => onAdd(row)}
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
  add: {
    marginTop: t.spacing(2),
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

  const onAddRow = React.useCallback((row: Row) => setLayout(addRowAfter(row.id)), [])

  return (
    <div className={cx(classes.root, className)}>
      {state instanceof Error ? (
        <M.Typography color="error">{state.message}</M.Typography>
      ) : null}

      {layout.rows.map((row, index) => (
        <AddRow
          disabled={disabled}
          key={row.id}
          last={index === layout.rows.length - 1}
          onAdd={onAddRow}
          onChange={setLayout}
          row={row}
        />
      ))}

      <div className={classes.actions}>
        <M.Button onClick={handleSubmit} disabled={disabled}>
          Submit
        </M.Button>
      </div>
    </div>
  )
}

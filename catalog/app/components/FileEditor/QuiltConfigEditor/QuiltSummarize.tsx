import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { FileExtended } from 'components/Preview/loaders/summarize'
// import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

// import { docs } from 'constants/urls'
// import StyledLink from 'utils/StyledLink'
import type { QuiltConfigEditorProps } from './QuiltConfigEditor'

type Row = FileExtended[]

type Layout = Row[]

function parse(str: string): Layout {
  const permissive = JSON.parse(str)
  // TODO: validate with JSON Schema
  if (!permissive) return []
  if (!Array.isArray(permissive)) throw new Error('Expected array')
  return permissive.map((row) => {
    const columns = Array.isArray(row) ? row : [row]
    return columns.map((file) => (typeof file === 'object' ? file : { path: file }))
  })
}

function stringify(layout: Layout) {
  return JSON.stringify(layout.map((row) => row.map((file) => file.path)))
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
    width: t.spacing(20),
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
  onChange: (columnIndex: number, file: FileExtended) => void
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
          onChange={(f) => onChange(j, f)}
          disabled={disabled}
        />
      ))}
      <Placeholder
        className={classes.add}
        onClick={() => onAddColumn({ path: '' })}
        disabled={disabled}
      />
    </div>
  )
}

const useAddFileStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    animation: '$show 0.3s ease-out',
  },
  extended: {
    marginRight: t.spacing(1),
  },
  path: {
    display: 'flex',
    alignItems: 'center',
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
}

function AddFile({ className, disabled, file, onChange }: AddFileProps) {
  const classes = useAddFileStyles()
  // TODO: simple mode instead of advanced
  //       save to simple entered fields, and restore them
  const [advanced, setAdvanced] = React.useState(false)
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.path}>
        <M.IconButton
          className={classes.extended}
          onClick={() => setAdvanced((a) => !a)}
          color={advanced ? 'primary' : 'default'}
        >
          <M.Icon>tune</M.Icon>
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
        <>
          <M.TextField
            disabled={disabled}
            label="Description"
            name="description"
            onChange={(event) =>
              onChange({ ...file, description: event.currentTarget.value })
            }
            value={file.description}
            fullWidth
          />
          <M.TextField
            disabled={disabled}
            label="Title"
            name="title"
            onChange={(event) => onChange({ ...file, title: event.currentTarget.value })}
            value={file.title}
            fullWidth
          />
        </>
      )}
    </div>
  )
}

const init = (payload?: Layout) => () => payload || ([] as Layout)

const addRow = (file: FileExtended) => (layout: Layout) => [...layout, [file]]

const addColumn = (rowIndex: number) => (file: FileExtended) => (layout: Layout) =>
  layout.toSpliced(rowIndex, 1, [...layout[rowIndex], file])

const changeValue =
  (rowIndex: number, columnIndex: number) => (file: FileExtended) => (layout: Layout) =>
    layout.toSpliced(rowIndex, 1, layout[rowIndex].toSpliced(columnIndex, 1, file))

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
  const [layout, setLayout] = React.useState<Layout>([[{ path: '' }]])
  React.useEffect(() => {
    if (!initialValue) return setLayout(init())
    try {
      setLayout(init(parse(initialValue)))
    } catch (e) {
      setState(e instanceof Error ? e : new Error(`${e}`))
    }
  }, [initialValue])
  const [state, setState] = React.useState<Error | null>(error)
  const handleAddRow = React.useCallback(() => {
    setLayout(addRow({ path: '' }))
  }, [])
  const handleSubmit = React.useCallback(() => {
    try {
      const summarize = stringify(layout)
      onChange(summarize)
    } catch (e) {
      setState(e instanceof Error ? e : new Error(`${e}`))
    }
  }, [layout, onChange])
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
          onAddColumn={(f) => setLayout(addColumn(i)(f))}
          onChange={(j, f) => setLayout(changeValue(i, j)(f))}
          disabled={disabled}
        />
      ))}

      <div className={classes.row}>
        <Placeholder className={classes.add} onClick={handleAddRow} disabled={disabled} />
      </div>

      <div className={classes.actions}>
        <M.Button onClick={handleSubmit} disabled={disabled}>
          Submit
        </M.Button>
      </div>
    </div>
  )
}

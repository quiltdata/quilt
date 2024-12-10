import cx from 'classnames'
import invariant from 'invariant'
import { nanoid } from 'nanoid'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import * as M from '@material-ui/core'

import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

import type * as Summarize from 'components/Preview/loaders/summarize'
import Skeleton from 'components/Skeleton'
import { docs } from 'constants/urls'
import * as requests from 'containers/Bucket/requests'
import * as Listing from 'containers/Bucket/Listing'
import { useData } from 'utils/Data'
import * as Dialogs from 'utils/GlobalDialogs'
import { makeSchemaValidator } from 'utils/JSONSchema'
import Log from 'utils/Logging'
import StyledLink from 'utils/StyledLink'

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
  id: nanoid(3),
  file,
})

const createRow = (file: FileExtended): Row => ({
  id: nanoid(3),
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
  (file: Partial<FileExtended>) =>
  (layout: Layout): Layout => ({
    rows: replace(layout.rows, rowId, (row) => ({
      ...row,
      columns: replace(row.columns, columnId, (column) => ({
        ...column,
        file: {
          ...column.file,
          ...file,
        },
      })),
    })),
  })

const removeColumn =
  (rowId: string, columnId: string) =>
  (layout: Layout): Layout => {
    const rowIndex = layout.rows.findIndex((r) => r.id === rowId)
    if (layout.rows[rowIndex].columns.length === 1) {
      return {
        rows: layout.rows.toSpliced(rowIndex, 1),
      }
    }
    return {
      rows: replace(layout.rows, rowId, (row) => ({
        ...row,
        columns: row.columns.filter((c) => c.id !== columnId),
      })),
    }
  }

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

function preStringifyColumn(column: Column): Summarize.File {
  const {
    file: { isExtended, type, path, ...file },
  } = column
  if (!type) {
    if (!Object.keys(file).length) return path
    return {
      path,
      ...file,
    }
  }
  return {
    types: [type],
    path,
    ...file,
  }
}

function validate(config: any) {
  const errors = makeSchemaValidator(quiltSummarizeSchema)(config)
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join('\n'))
  }
  return undefined
}

function parse(str: string): Layout {
  const config = JSON.parse(str)

  if (!config) return { rows: [] }
  if (!Array.isArray(config)) throw new Error('Expected array')

  validate(config)

  return {
    rows: config.map((row) => ({
      id: nanoid(2),
      columns: Array.isArray(row) ? row.map(parseColumn) : [parseColumn(row)],
    })),
  }
}

function stringify(layout: Layout) {
  const converted = layout.rows
    .map((row) => {
      const columns = row.columns.filter(({ file }) => file.path).map(preStringifyColumn)
      return columns.length > 1 ? columns : columns[0]
    })
    .filter(Boolean)

  validate(converted)

  return JSON.stringify(converted, null, 2)
}

function useFormattedListing(r: requests.BucketListingResult): Listing.Item[] {
  return React.useMemo(() => {
    const d = r.dirs.map((p) => Listing.Entry.Dir({ key: p }))
    const f = r.files.map(Listing.Entry.File)
    return Listing.format([...d, ...f], { bucket: r.bucket, prefix: r.path })
  }, [r])
}

interface FilePickerProps {
  res: requests.BucketListingResult
  onCell: (item: Listing.Item) => void
}

function FilePicker({ res, onCell }: FilePickerProps) {
  const items = useFormattedListing(res)
  const CellComponent = React.useCallback(
    ({ item, ...props }) => (
      <div
        role="button"
        style={{ cursor: 'pointer' }}
        onClick={() => onCell(item)}
        {...props}
      />
    ),
    [onCell],
  )
  return <Listing.Listing {...{ CellComponent, RootComponent: 'div', items }} />
}

const useFilePickerSkeletonStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  toolbar: {
    display: 'flex',
  },
  toolbarSkeleton: {
    width: t.spacing(20),
    height: t.spacing(4.5) - 20 /*margin*/,
    margin: '10px 0 10px auto',
  },
  divided: {
    height: t.spacing(4.5) - 2 /*border*/ - 20 /*margin*/,
    margin: '10px 0',
  },
  item: {
    height: t.spacing(4.5) - 20 /*margin*/,
    margin: '10px 0',
  },
}))

function FilePickerSkeleton() {
  const classes = useFilePickerSkeletonStyles()
  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Skeleton className={classes.toolbarSkeleton} />
      </div>
      <M.Divider />
      <Skeleton className={classes.divided} />
      <M.Divider />
      {Array.from({ length: 25 }).map((_, i) => (
        <Skeleton
          width={`${Math.min(75, Math.max(25, Math.ceil(Math.random() * 100)))}%`}
          className={classes.item}
          key={i}
        />
      ))}
      <M.Divider />
      <Skeleton className={classes.divided} />
      <M.Divider />
      <div className={classes.toolbar}>
        <Skeleton className={classes.toolbarSkeleton} />
      </div>
    </div>
  )
}

interface FilePickerDialogProps {
  bucket: string
  submit: (path: string) => void
}

function FilePickerDialog({ bucket, submit }: FilePickerDialogProps) {
  const [path, setPath] = React.useState('')
  const bucketListing = requests.useBucketListing()
  const data = useData(bucketListing, {
    bucket,
    path,
    prefix: '',
    prev: null,
    drain: true,
  })
  const handleCellClick = React.useCallback(
    (item: Listing.Item) => {
      if (item.type === 'dir') {
        setPath(item.to)
      } else {
        submit(item.to)
      }
    },
    [submit],
  )
  return (
    <>
      {data.case({
        _: () => <FilePickerSkeleton />,
        Ok: (res: requests.BucketListingResult) => (
          <FilePicker res={res} onCell={handleCellClick} />
        ),
      })}
    </>
  )
}

const useAddColumnStyles = M.makeStyles((t) => ({
  root: {
    animation: '$show 0.15s ease-out',
    display: 'flex',
    '&:last-child $divider': {
      marginLeft: t.spacing(4),
    },
  },
  inner: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    '&:has($close:hover) $path': {
      opacity: 0.3,
    },
    '&:has($close:hover) $extended': {
      opacity: 0.3,
    },
  },
  settings: {
    margin: t.spacing(0, 1, -1, -0.5),
    transition: 'transform 0.15s ease-out',
    '&:hover': {
      transform: 'rotate(180deg)',
    },
  },
  extended: {
    animation: '$slide 0.15s ease-out',
    transition: 'opacity 0.3s ease-out',
    paddingLeft: t.spacing(7),
    display: 'flex',
    flexDirection: 'column',
  },
  expanded: {
    background: t.palette.background.paper,
    position: 'absolute',
    right: '16px',
    top: '4px',
  },
  path: {
    transition: 'opacity 0.3s ease-out',
    display: 'flex',
    alignItems: 'flex-end',
  },
  field: {
    marginTop: t.spacing(1),
    minWidth: t.spacing(10),
  },
  divider: {
    marginLeft: t.spacing(2),
  },
  render: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(3),
    padding: t.spacing(2),
  },
  select: {
    marginTop: t.spacing(2),
  },
  toggle: {
    padding: t.spacing(1, 0, 0),
  },
  close: {
    position: 'absolute',
    right: 0,
    top: 0,
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
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(bucket, '`bucket` must be defined')

  const classes = useAddColumnStyles()
  const { file } = column
  // TODO: [simple, setSimple] mode instead of advanced
  //       save entered fields to `simple`, and restore them
  const [advanced, setAdvanced] = React.useState(file.isExtended)

  const onChangeValue = React.useCallback(
    (key: keyof FileExtended, value: FileExtended[keyof FileExtended]) => {
      const dispatch = changeValue(row.id, column.id)
      onChange(dispatch({ [key]: value }))
    },
    [onChange, row.id, column.id],
  )

  const onChangeType = React.useCallback(
    (
      key: keyof Summarize.TypeExtended,
      value: Summarize.TypeExtended[keyof Summarize.TypeExtended],
    ) =>
      onChangeValue('type', {
        ...((file.type || {}) as Summarize.TypeExtended),
        [key]: value,
      }),
    [onChangeValue, file.type],
  )

  const onRemove = React.useCallback(
    () => onChange(removeColumn(row.id, column.id)),
    [onChange, row.id, column.id],
  )

  const pickPath = React.useCallback(
    (path: string, close: () => void) => {
      onChangeValue('path', path)
      close()
    },
    [onChangeValue],
  )

  const openDialog = Dialogs.use()
  const handlePicker = React.useCallback(() => {
    openDialog(
      ({ close }) => (
        <>
          <M.DialogContent>
            <FilePickerDialog bucket={bucket} submit={(path) => pickPath(path, close)} />
          </M.DialogContent>
          <M.DialogActions>
            <M.Button onClick={close}>Cancel</M.Button>
          </M.DialogActions>
        </>
      ),
      { maxWidth: 'xl' as const, fullWidth: true },
    )
  }, [bucket, openDialog, pickPath])

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
            value={file.path || ''}
            fullWidth
            InputProps={{
              startAdornment: (
                <M.InputAdornment position="start">
                  <M.IconButton size="small" onClick={handlePicker}>
                    <M.Icon fontSize="inherit">attach_file</M.Icon>
                  </M.IconButton>
                </M.InputAdornment>
              ),
            }}
          />
        </div>
        {advanced && (
          <div className={classes.extended}>
            <M.TextField
              disabled={disabled}
              label="Title"
              name="title"
              onChange={(event) => onChangeValue('title', event.currentTarget.value)}
              value={file.title || ''}
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
              value={file.description || ''}
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
                label="Expand"
                title="Whether preview is expanded by default or not"
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
                    value={file.width || ''}
                    fullWidth
                    className={classes.field}
                    size="small"
                    helperText="Width in pixels or percents"
                  />
                )}

                <M.FormControl className={classes.field} fullWidth size="small">
                  <M.InputLabel>Renderer</M.InputLabel>
                  <M.Select
                    className={classes.select}
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
                    value={file.type.style?.height || ''}
                    fullWidth
                    className={classes.field}
                    size="small"
                    placeholder="Ex., 1000px"
                    helperText="Height as an absolute value (in `px`, `vh`, `em` etc.)"
                  />
                )}

                {file.type?.name === 'perspective' && (
                  <M.TextField
                    disabled={disabled}
                    label="Perspective config"
                    name="config"
                    onChange={(event) => {
                      try {
                        onChangeType('config', JSON.parse(event.currentTarget.value))
                      } catch (error) {
                        Log.error(error)
                      }
                    }}
                    helperText="Restores renderer to a state previously returned by saving config. Should be valid JSON object"
                    value={file.type.config || '{}'}
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
        <M.IconButton size="small" className={classes.close} onClick={onRemove}>
          <M.Icon fontSize="inherit">close</M.Icon>
        </M.IconButton>
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
  disabled: {},
  expanded: {},
  horizontal: {},
  vertical: {},
  root: {
    padding: t.spacing(2),
    position: 'relative',
    '&:hover:not($expanded):not($disabled) $icon': {
      display: 'block',
    },
    '&:hover:not($expanded):not($disabled) $inner': {
      outlineOffset: '-4px',
    },
  },
  icon: {
    display: 'none',
    transition: 'transform 0.15s ease-out',
    '$expanded &': {
      display: 'block',
    },
    '$root:hover &': {
      transform: 'rotate(90deg)',
    },
  },
  inner: {
    alignItems: 'center',
    background: t.palette.divider,
    borderRadius: t.shape.borderRadius,
    bottom: 0,
    color: t.palette.background.paper,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    outline: `2px dashed ${t.palette.background.paper}`,
    outlineOffset: '-2px',
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    transition:
      'top 0.15s ease-out, bottom 0.15s ease-out,left 0.15s ease-out, right 0.15s ease-out',
    '$expanded &:hover': {
      opacity: 1,
    },
    '$horizontal:not($expanded):not(:hover) &': {
      bottom: `calc(${t.spacing(2)}px - 1px)`,
      top: `calc(${t.spacing(2)}px - 1px)`,
    },
    '$vertical:not($expanded):not(:hover) &': {
      left: `calc(${t.spacing(2)}px - 1px)`,
      right: `calc(${t.spacing(2)}px - 1px)`,
    },
    '$expanded &': {
      opacity: 0.7,
      outlineOffset: '-4px',
    },
  },
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
    '&:last-child $divider': {
      marginTop: t.spacing(4),
    },
  },
  inner: {
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
  className: string
  disabled?: boolean
  row: Row
  onChange: React.Dispatch<React.SetStateAction<Layout>>
  last: boolean
}

function AddRow({ className, onChange, disabled, row, last }: AddRowProps) {
  const classes = useAddRowStyles()

  const onAdd = React.useCallback(() => onChange(addRowAfter(row.id)), [onChange, row.id])

  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.inner}>
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
        onClick={onAdd}
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
    marginTop: t.spacing(2),
  },
  caption: {
    ...t.typography.body2,
    marginTop: t.spacing(2),
    textAlign: 'center',
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
  const [state, setState] = React.useState<Error | null>(error)

  React.useEffect(() => {
    if (!initialValue) return
    try {
      setLayout(init(parse(initialValue)))
    } catch (e) {
      setState(e instanceof Error ? e : new Error(`${e}`))
    }
  }, [initialValue])

  const [value] = useDebounce(layout, 300)
  React.useEffect(() => onChange(stringify(value)), [onChange, value])

  return (
    <div className={cx(classes.root, className)}>
      {state instanceof Error ? (
        <M.Typography color="error">{state.message}</M.Typography>
      ) : null}

      <div>
        {layout.rows.map((row, index) => (
          <AddRow
            className={classes.row}
            disabled={disabled}
            key={row.id}
            last={index === layout.rows.length - 1}
            onChange={setLayout}
            row={row}
          />
        ))}
        {!layout.rows.length && (
          <Placeholder
            variant="horizontal"
            className={classes.row}
            expanded
            onClick={() => setLayout(init())}
            disabled={disabled}
          />
        )}
      </div>

      <p className={classes.caption}>
        Configuration for quilt_summarize.json. See{' '}
        <StyledLink
          href={`${docs}/quilt-platform-catalog-user/visualizationdashboards#quilt_summarize.json`}
          target="_blank"
        >
          the docs
        </StyledLink>
      </p>
    </div>
  )
}

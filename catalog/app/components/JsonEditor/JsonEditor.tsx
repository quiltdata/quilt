import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as JSONPointer from 'utils/JSONPointer'
import { EMPTY_SCHEMA, JsonSchema } from 'utils/json-schema'

import illustrationEnterValues from './enter-values.webm'
import illustrationObjectExpand from './object-expand.webm'
import Column from './Column'
import State, { StateRenderProps } from './State'
import { JsonValue, RowData, ValidationErrors } from './constants'

const useEmptyStateCaseStyles = M.makeStyles((t) => ({
  icon: {
    position: 'absolute',
    right: t.spacing(2),
    top: t.spacing(2),
  },
}))

interface EmptyStateCaseProps {
  children: React.ReactNode
  className: string
  title: string
  video: string
}

function EmptyStateCase({ children, className, title, video }: EmptyStateCaseProps) {
  const classes = useEmptyStateCaseStyles()
  const [expanded, setExpanded] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const togglePlayback = React.useCallback(() => {
    const el = videoRef?.current
    if (el?.paused) {
      el?.play()
    } else {
      el?.pause()
    }
  }, [videoRef])
  const toggle = React.useCallback(() => setExpanded((x) => !x), [])
  return (
    <div className={className}>
      <M.Grow in={expanded}>
        <M.Card>
          <M.CardContent>
            <M.Typography variant="h5">{title}</M.Typography>
            <M.Typography variant="body1">{children}</M.Typography>
            <video
              ref={videoRef}
              src={video}
              width="100%"
              autoPlay
              loop
              onClick={togglePlayback}
            />
          </M.CardContent>
        </M.Card>
      </M.Grow>
      <M.IconButton onClick={toggle} size="small" className={classes.icon}>
        <M.Icon fontSize="small">{expanded ? 'close' : 'help_outline'}</M.Icon>
      </M.IconButton>
    </div>
  )
}

interface EmptyStateProps {
  className: string
  noValue: boolean
  notExpanded: boolean
}

function EmptyState({ className, noValue, notExpanded }: EmptyStateProps) {
  if (noValue && notExpanded) {
    return (
      <EmptyStateCase
        className={className}
        title="JSON editor is empty"
        video={illustrationEnterValues}
      >
        Start filling empty rows as in Excel. You can enter values by hand. Type{' '}
        <Code>{`{}`}</Code> to create an object, or <Code>{`[]`}</Code> to create an
        array, and then traverse it to enter properties.
      </EmptyStateCase>
    )
  }

  if (notExpanded) {
    return (
      <EmptyStateCase
        className={className}
        title="There is more data here"
        video={illustrationObjectExpand}
      >
        Try to expand object values
      </EmptyStateCase>
    )
  }

  return null
}

interface ColumnData {
  items: RowData[]
  parent?: JsonValue
}

function shouldSqueezeColumn(columnIndex: number, columns: ColumnData[]) {
  return columns.length > 2 && columnIndex > 0 && columnIndex < columns.length - 1
}

const useSqueezeStyles = M.makeStyles((t) => ({
  root: {
    alignSelf: 'flex-start',
    cursor: 'pointer',
    margin: t.spacing(0, 2),
    padding: '5px 0',

    '& + &': {
      marginLeft: 0,
    },
  },
}))

interface SqueezeProps {
  columnPath: JSONPointer.Path
  onClick: () => void
}

function Squeeze({ columnPath, onClick }: SqueezeProps) {
  const classes = useSqueezeStyles()
  return (
    <div
      className={classes.root}
      title={`# > ${columnPath.join(' > ')}`}
      onClick={onClick}
    >
      <M.Icon>more_horiz</M.Icon>
    </div>
  )
}

const useStyles = M.makeStyles<any, { multiColumned: boolean }>((t) => ({
  root: {
    height: ({ multiColumned }) => (multiColumned ? '100%' : 'auto'),
    position: 'relative',
  },
  disabled: {
    position: 'relative',
    '&:after': {
      background: 'rgba(255,255,255,0.9)',
      bottom: 0,
      content: '""',
      cursor: 'not-allowed',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
    },
  },
  inner: {
    display: 'flex',
    height: ({ multiColumned }) => (multiColumned ? '100%' : 'auto'),
    overflow: 'auto',
    position: 'relative',
  },
  column: {
    height: ({ multiColumned }) => (multiColumned ? '100%' : 'auto'),
    maxWidth: t.spacing(76),
    overflowY: 'auto',
  },
  help: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: t.spacing(60),
  },
}))

interface JsonEditorProps extends StateRenderProps {
  className?: string
  disabled?: boolean
  multiColumned: boolean
  onChange: (value: JsonValue) => JsonValue
}

const JsonEditor = React.forwardRef<HTMLDivElement, JsonEditorProps>(function JsonEditor(
  {
    addRow,
    changeValue,
    className,
    columns,
    disabled,
    fieldPath,
    jsonDict,
    menuFieldPath,
    multiColumned,
    onChange,
    removeField,
    setFieldPath,
    setMenuFieldPath,
    transformer,
  },
  ref,
) {
  const classes = useStyles({ multiColumned })
  const t = M.useTheme()
  const md = M.useMediaQuery(t.breakpoints.down('md'))

  const handleRowAdd = React.useCallback(
    (path: JSONPointer.Path, key: string | number, value: JsonValue) => {
      const newData = addRow(path, key, value)
      if (newData) onChange(newData)
    },
    [addRow, onChange],
  )

  const handleRowRemove = React.useCallback(
    (path: JSONPointer.Path) => {
      const newData = removeField(path)
      if (newData) onChange(newData)
    },
    [removeField, onChange],
  )

  const handleValueChange = React.useCallback(
    (path: JSONPointer.Path, key: 'key' | 'value', value: JsonValue | string) => {
      const newData = changeValue(path, key, value)
      if (newData) onChange(newData)
    },
    [changeValue, onChange],
  )

  const handleToolbar = React.useCallback(
    (transform) => {
      onChange(transformer(transform))
    },
    [onChange, transformer],
  )

  if (!columns.length) throw new Error('No column data')

  const columnsView = React.useMemo(
    () => (multiColumned ? columns : ([R.last(columns)] as ColumnData[])),
    [columns, multiColumned],
  )

  return (
    <div className={cx(classes.root, { [classes.disabled]: disabled }, className)}>
      <div className={classes.inner} ref={ref}>
        {columnsView.map((columnData, index) => {
          const columnPath = multiColumned ? fieldPath.slice(0, index) : fieldPath
          return shouldSqueezeColumn(index, columns) ? (
            <Squeeze
              columnPath={columnPath}
              key={columnPath.join(',')}
              onClick={() => setFieldPath(columnPath)}
            />
          ) : (
            <Column
              className={classes.column}
              columnPath={columnPath}
              contextMenuPath={menuFieldPath}
              data={columnData}
              hasSiblingColumn={multiColumned}
              jsonDict={jsonDict}
              key={columnPath.join(',')}
              onAddRow={handleRowAdd}
              onBreadcrumb={setFieldPath}
              onChange={handleValueChange}
              onContextMenu={setMenuFieldPath}
              onExpand={setFieldPath}
              onRemove={handleRowRemove}
              onToolbar={handleToolbar}
            />
          )
        })}
      </div>
      {multiColumned && !md && (
        <EmptyState
          className={classes.help}
          noValue={!columns[0].parent || R.isEmpty(columns[0].parent)}
          notExpanded={columnsView.length < 2}
        />
      )}
    </div>
  )
})

interface JsonEditorWrapperProps {
  className?: string
  disabled?: boolean
  errors: ValidationErrors
  multiColumned?: boolean
  onChange: (value: JsonValue) => void
  schema?: JsonSchema
  value: JsonValue
}

export default React.forwardRef<HTMLDivElement, JsonEditorWrapperProps>(
  function JsonEditorWrapper(
    { className, disabled, errors, multiColumned, onChange, schema: optSchema, value },
    ref,
  ) {
    const schema = optSchema || EMPTY_SCHEMA

    return (
      <State errors={errors} jsonObject={value} schema={schema}>
        {(stateProps: StateRenderProps) => (
          <JsonEditor
            {...{
              className,
              disabled,
              onChange,
              multiColumned: !!multiColumned,
              ref,
            }}
            {...stateProps}
          />
        )}
      </State>
    )
  },
)

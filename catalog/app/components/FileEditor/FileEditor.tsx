import * as React from 'react'
import * as brace from 'brace'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import type { S3HandleBase } from 'utils/s3paths'
import { useObjectGetter } from 'components/Preview/loaders/utils'
import Skeleton from 'components/Skeleton'

import 'brace/mode/markdown'
import 'brace/theme/eclipse'

const useSkeletonStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    height: t.spacing(30),
    width: '100%',
  },
  lineNumbers: {
    height: '100%',
    width: t.spacing(5),
  },
  content: {
    flexGrow: 1,
    marginLeft: t.spacing(2),
  },
  line: {
    height: t.spacing(2),
    marginBottom: t.spacing(0.5),
  },
}))

const fakeLines = [80, 50, 100, 60, 30, 80, 50, 100, 60, 30, 20, 70]

function EditorSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.root}>
      <Skeleton className={classes.lineNumbers} height="100%" />
      <div className={classes.content}>
        {fakeLines.map((width, index) => (
          <Skeleton className={classes.line} width={`${width}%`} key={width + index} />
        ))}
      </div>
    </div>
  )
}

export function useWriteData({ bucket, key }: S3HandleBase) {
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (value) => {
      await s3.putObject({ Bucket: bucket, Key: key, Body: value }).promise()
    },
    [bucket, key, s3],
  )
}

interface EditorState {
  editing: boolean
  onCancel: () => void
  onChange: (value: string) => void
  onEdit: () => void
  onSave: () => Promise<void>
  value?: string
}

// TODO: use Provider
export function useState(handle: S3HandleBase): EditorState {
  const [value, setValue] = React.useState<string | undefined>()
  const [editing, setEditing] = React.useState<boolean>(false)
  const writeFile = useWriteData(handle)
  const onSave = React.useCallback(async () => {
    await writeFile(value)
    setEditing(false)
  }, [value, writeFile])
  const onCancel = React.useCallback(() => setEditing(false), [])
  const onEdit = React.useCallback(() => setEditing(true), [])
  return React.useMemo(
    () => ({
      editing,
      onCancel,
      onChange: setValue,
      onEdit,
      onSave,
      value,
    }),
    [editing, onCancel, onEdit, onSave, value],
  )
}

interface ButtonControlProps {
  className?: string
  color?: 'primary'
  icon: string
  label: string
  onClick: () => void
  variant?: 'outlined' | 'contained'
}

function ButtonControl({
  className,
  color,
  icon,
  label,
  onClick,
  variant = 'outlined',
}: ButtonControlProps) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  return sm ? (
    <M.IconButton
      className={className}
      edge="end"
      size="small"
      onClick={onClick}
      title={label}
      color={color}
    >
      <M.Icon>{icon}</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button
      className={className}
      color={color}
      onClick={onClick}
      size="small"
      startIcon={<M.Icon>{icon}</M.Icon>}
      variant={variant}
    >
      {label}
    </M.Button>
  )
}

interface ControlsProps {
  className?: string
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export function Controls({
  className,
  editing,
  onEdit,
  onSave,
  onCancel,
}: ControlsProps) {
  if (!editing)
    return (
      <ButtonControl label="Edit" onClick={onEdit} icon="edit" className={className} />
    )
  return (
    <M.ButtonGroup className={className} size="small">
      <ButtonControl icon="undo" onClick={onCancel} label="Cancel" />
      <ButtonControl
        color="primary"
        icon="save"
        label="Save"
        onClick={onSave}
        variant="contained"
      />
    </M.ButtonGroup>
  )
}

const useEditorTextStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
    minHeight: t.spacing(30),
    border: `1px solid ${t.palette.divider}`,
  },
}))

interface EditorTextProps {
  value?: string
  onChange: (value: string) => void
}

function EditorText({ value = '', onChange }: EditorTextProps) {
  const classes = useEditorTextStyles()
  const ref = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!ref.current) return
    const editor = brace.edit(ref.current)
    editor.getSession().setMode('ace/mode/markdown')
    editor.setTheme('ace/theme/eclipse')
    editor.setValue(value, -1)
    editor.on('change', () => onChange(editor.getValue()))
    return () => editor.destroy()
  }, [onChange, ref, value])
  return <div className={classes.root} ref={ref} />
}

interface EditorProps {
  handle: S3HandleBase
  onChange: (value: string) => void
}

export function Editor({ handle, onChange }: EditorProps) {
  const data = useObjectGetter(handle)
  return data.case({
    _: () => <EditorSkeleton />,
    // TODO: Err
    Ok: (response: $TSFixMe) => {
      const value = response.Body.toString('utf-8')
      return <EditorText value={value} onChange={onChange} />
    },
  })
}

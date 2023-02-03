import { edit } from 'brace'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Lock from 'components/Lock'
import FileType from 'components/Preview/loaders/fileType'

import Skeleton from './Skeleton'
import { EditorInputType, Mode } from './types'

import 'brace/theme/eclipse'

function getBraceMode(mode: Mode) {
  switch (mode) {
    case '__quiltConfig':
    case FileType.Yaml:
      return 'brace/mode/yaml'
    case FileType.ECharts:
    case FileType.Igv:
    case FileType.Json:
    case FileType.Vega:
      return 'brace/mode/json'
    case FileType.Html:
      return 'brace/mode/html'
    case FileType.Jupyter:
    case FileType.Voila:
      return 'brace/mode/python'
    case FileType.Markdown:
      return 'markdown'
    case FileType.Tabular:
      return 'brace/mode/less'
    case FileType.Ngl:
    case FileType.Text:
    default:
      return 'brace/mode/plain_text'
  }
}

const cache: { [index in Mode]?: Promise<void> | 'fullfilled' } = {}
export const loadMode = (mode: Mode) => {
  if (cache[mode] === 'fullfilled') return cache[mode]
  if (cache[mode]) throw cache[mode]

  cache[mode] = import(getBraceMode(mode)).then(() => {
    cache[mode] = 'fullfilled'
  })
  throw cache[mode]
}

const useEditorTextStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.divider}`,
    width: '100%',
    position: 'relative',
  },
  editor: {
    height: t.spacing(50),
    resize: 'vertical',
  },
  error: {
    marginTop: t.spacing(1),
  },
}))

export interface TextEditorProps {
  disabled?: boolean
  onChange: (value: string) => void
  type: EditorInputType
  value?: string
  error: Error | null
}

export default function TextEditorSuspended({
  error,
  disabled,
  type,
  value = '',
  onChange,
}: TextEditorProps) {
  if (type.type !== '__quiltConfig') {
    loadMode(type.type || FileType.Text) // TODO: loaders#typeText.brace
  }

  const classes = useEditorTextStyles()
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const wrapper = ref.current
    if (!wrapper) return

    const editor = edit(wrapper)

    const resizeObserver = new window.ResizeObserver(() => editor.resize())
    resizeObserver.observe(wrapper)

    editor.getSession().setMode(`ace/mode/${type.type}`)
    editor.setTheme('ace/theme/eclipse')
    editor.setValue(value, -1)
    onChange(editor.getValue()) // initially fill the value
    editor.on('change', () => onChange(editor.getValue()))

    return () => {
      resizeObserver.unobserve(wrapper)
      editor.destroy()
    }
  }, [onChange, ref, type.type, value])

  return (
    <div className={classes.root}>
      <div className={classes.editor} ref={ref} />
      {error && (
        <Lab.Alert severity="error" className={classes.error} variant="outlined">
          {error.message}
        </Lab.Alert>
      )}
      {disabled && <Lock />}
    </div>
  )
}

export function TextEditor(props: TextEditorProps) {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <TextEditorSuspended {...props} />
    </React.Suspense>
  )
}

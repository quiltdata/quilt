import { edit } from 'brace'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Lock from 'components/Lock'

import Skeleton from './Skeleton'
import { EditorInputType, Mode } from './types'

import 'brace/theme/eclipse'

const cache: { [index in Mode]?: Promise<void> | 'fullfilled' } = {}
export const loadMode = (mode: Mode) => {
  if (cache[mode] === 'fullfilled') return cache[mode]
  if (cache[mode]) throw cache[mode]

  cache[mode] = import(`brace/mode/${mode}`).then(() => {
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

interface TextEditorProps {
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
  if (type.brace !== '__quiltConfig') {
    loadMode(type.brace || 'plain_text') // TODO: loaders#typeText.brace
  }

  const classes = useEditorTextStyles()
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const wrapper = ref.current
    if (!wrapper) return

    const editor = edit(wrapper)

    const resizeObserver = new window.ResizeObserver(() => editor.resize())
    resizeObserver.observe(wrapper)

    editor.getSession().setMode(`ace/mode/${type.brace}`)
    editor.setTheme('ace/theme/eclipse')
    editor.setValue(value, -1)
    onChange(editor.getValue()) // initially fill the value
    editor.on('change', () => onChange(editor.getValue()))

    return () => {
      resizeObserver.unobserve(wrapper)
      editor.destroy()
    }
  }, [onChange, ref, type.brace, value])

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

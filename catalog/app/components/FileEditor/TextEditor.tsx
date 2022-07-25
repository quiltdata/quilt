import * as brace from 'brace'
import * as React from 'react'
import * as M from '@material-ui/core'

import { EditorInputType } from './types'

import 'brace/theme/eclipse'

const useEditorTextStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.divider}`,
    minHeight: t.spacing(50),
    resize: 'vertical',
    width: '100%',
  },
}))

interface TextEditorProps {
  onChange: (value: string) => void
  type: EditorInputType
  value?: string
}

export default function TextEditor({ type, value = '', onChange }: TextEditorProps) {
  const classes = useEditorTextStyles()
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const wrapper = ref.current
    if (!wrapper) return

    const editor = brace.edit(wrapper)

    const resizeObserver = new window.ResizeObserver(() => editor.resize())
    resizeObserver.observe(wrapper)

    editor.getSession().setMode(`ace/mode/${type.brace}`)
    editor.setTheme('ace/theme/eclipse')
    editor.setValue(value, -1)
    editor.on('change', () => onChange(editor.getValue()))

    return () => {
      resizeObserver.unobserve(wrapper)
      editor.destroy()
    }
  }, [onChange, ref, type.brace, value])

  return <div className={classes.root} ref={ref} />
}

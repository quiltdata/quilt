import * as React from 'react'
import * as brace from 'brace'
import * as M from '@material-ui/core'

import 'brace/mode/markdown'
import 'brace/theme/eclipse'

const useEditorTextStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  editor: {
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
  return (
    <div className={classes.root}>
      <div className={classes.editor} ref={ref} />
    </div>
  )
}

export default (
  { value, onChange }: EditorTextProps,
  props: React.HTMLAttributes<HTMLDivElement>,
) => <EditorText {...props} value={value} onChange={onChange} />

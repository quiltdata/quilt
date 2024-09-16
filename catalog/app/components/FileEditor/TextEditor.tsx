import * as brace from 'brace'
import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Lock from 'components/Lock'

import { EditorInputType } from './types'

import 'brace/theme/eclipse'

const useEditorTextStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.divider}`,
    position: 'relative',
    width: '100%',
  },
  editor: {
    height: '100%',
    resize: 'vertical',
  },
  error: {
    marginTop: t.spacing(1),
  },
}))

interface TextEditorProps {
  className: string
  disabled?: boolean
  error: Error | null
  leadingChange?: boolean
  onChange: (value: string) => void
  type: EditorInputType
  initialValue?: string
}

export default function TextEditor({
  className,
  disabled,
  error,
  leadingChange = true,
  onChange,
  type,
  initialValue = '',
}: TextEditorProps) {
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

    editor.$blockScrolling = Infinity
    editor.setValue(initialValue, -1)
    if (leadingChange) {
      // Initially fill the value in the parent component.
      // TODO: Re-design fetching data, so leading onChange won't be necessary
      //       probably, by putting data fetch into FileEditor/State
      onChange(editor.getValue())
      editor.focus()
    }
    editor.on('change', () => onChange(editor.getValue()))

    return () => {
      resizeObserver.unobserve(wrapper)
      editor.destroy()
    }
  }, [leadingChange, onChange, ref, type.brace, initialValue])

  return (
    <div className={cx(classes.root, className)}>
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

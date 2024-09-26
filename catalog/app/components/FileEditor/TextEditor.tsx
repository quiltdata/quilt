import * as brace from 'brace'
import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Lock from 'components/Lock'

import { EditorInputType } from './types'

import 'brace/theme/eclipse'

const useEditorTextStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    width: '100%',
  },
  editor: {
    border: `1px solid ${t.palette.divider}`,
    flexGrow: 1,
    resize: 'vertical',
  },
  error: {
    '& $editor': {
      borderColor: t.palette.error.main,
    },
    '& $helperText': {
      color: t.palette.error.main,
    },
  },
  helperText: {
    marginTop: t.spacing(0.5),
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
    }
    editor.on('change', () => onChange(editor.getValue()))

    editor.focus()
    wrapper.scrollIntoView()

    return () => {
      resizeObserver.unobserve(wrapper)
      editor.destroy()
    }
  }, [leadingChange, onChange, ref, type.brace, initialValue])

  return (
    <div className={cx(classes.root, className, { [classes.error]: !!error })}>
      <div className={classes.editor} ref={ref} />
      {error && (
        <M.Typography className={classes.helperText} variant="body2">
          {error.message}
        </M.Typography>
      )}
      {disabled && <Lock />}
    </div>
  )
}

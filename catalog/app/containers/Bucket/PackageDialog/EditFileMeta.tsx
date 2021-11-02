import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import JsonEditor from 'components/JsonEditor'
import { JsonValue } from 'components/JsonEditor/constants'

const useDialogStyles = M.makeStyles({
  paper: {
    height: '100vh',
  },
})

interface EditMetaProps {
  name: string
  value: JsonValue
  onChange: (value: JsonValue) => void
}

export default function EditFileMeta({ name, value, onChange }: EditMetaProps) {
  const dialogClasses = useDialogStyles()
  const [open, setOpen] = React.useState(false)
  const [innerValue, setInnerValue] = React.useState(value)
  const closeEditor = React.useCallback(() => setOpen(false), [setOpen])
  const openEditor = React.useCallback(() => setOpen(true), [setOpen])
  const handleSubmit = React.useCallback(() => {
    onChange(innerValue)
    closeEditor()
  }, [closeEditor, innerValue, onChange])
  return (
    <>
      <M.IconButton onClick={openEditor} title="Edit meta" size="small">
        <M.Icon fontSize="inherit" color={innerValue ? 'primary' : 'inherit'}>
          list
        </M.Icon>
      </M.IconButton>
      <M.Dialog
        fullWidth
        maxWidth="xl"
        onClose={closeEditor}
        open={open}
        classes={dialogClasses}
      >
        <M.DialogTitle>
          Metadata for <Code>{name}</Code>
        </M.DialogTitle>
        <M.DialogContent>
          <JsonEditor
            isMultiColumned
            value={innerValue}
            onChange={(v) => setInnerValue(v)}
          />
        </M.DialogContent>
        <M.DialogActions>
          <M.Button onClick={closeEditor}>Cancel</M.Button>
          <M.Button onClick={handleSubmit} variant="contained" color="primary">
            Submit
          </M.Button>
        </M.DialogActions>
      </M.Dialog>
    </>
  )
}

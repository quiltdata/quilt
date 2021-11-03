import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import { JsonValue } from 'components/JsonEditor/constants'
import MetadataEditor from 'components/MetadataEditor'

const useDialogStyles = M.makeStyles({
  paper: {
    height: '100vh',
  },
})

const useStyles = M.makeStyles({
  switch: {
    marginRight: 'auto',
  },
})

interface EditMetaProps {
  name: string
  value: JsonValue
  onChange: (value: JsonValue) => void
}

export default function EditFileMeta({ name, value, onChange }: EditMetaProps) {
  const dialogClasses = useDialogStyles()
  const classes = useStyles()
  const [open, setOpen] = React.useState(false)
  const [isRaw, setRaw] = React.useState(false)
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
          <MetadataEditor
            isMultiColumned
            isRaw={isRaw}
            value={innerValue}
            onChange={setInnerValue}
          />
        </M.DialogContent>
        <M.DialogActions>
          <M.FormControlLabel
            className={classes.switch}
            control={<M.Switch checked={isRaw} onChange={() => setRaw(!isRaw)} />}
            label="Edit raw data"
          />
          <M.Button onClick={closeEditor}>Cancel</M.Button>
          <M.Button onClick={handleSubmit} variant="contained" color="primary">
            Submit
          </M.Button>
        </M.DialogActions>
      </M.Dialog>
    </>
  )
}

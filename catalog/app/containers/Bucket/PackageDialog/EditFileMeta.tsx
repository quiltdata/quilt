import * as R from 'ramda'
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

interface DialogProps {
  name: string
  onChange: (value: JsonValue) => void
  onClose: () => void
  open: boolean
  value: JsonValue
}

function Dialog({ name, onChange, onClose, open, value }: DialogProps) {
  const [innerValue, setInnerValue] = React.useState(value)
  const classes = useStyles()
  const dialogClasses = useDialogStyles()
  const [isRaw, setRaw] = React.useState(false)
  const handleSubmit = React.useCallback(() => {
    onChange(innerValue)
    onClose()
  }, [innerValue, onChange, onClose])
  return (
    <M.Dialog
      fullWidth
      maxWidth="xl"
      onClose={onClose}
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
        <M.Button onClick={onClose}>Cancel</M.Button>
        <M.Button onClick={handleSubmit} variant="contained" color="primary">
          Submit
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface EditMetaProps {
  name: string
  value: JsonValue
  onChange: (value: JsonValue) => void
}

export default function EditFileMeta({ name, value, onChange }: EditMetaProps) {
  const [open, setOpen] = React.useState(false)
  const closeEditor = React.useCallback(() => setOpen(false), [setOpen])
  const openEditor = React.useCallback(() => setOpen(true), [setOpen])
  const color = React.useMemo(() => (R.isEmpty(value) ? 'inherit' : 'primary'), [value])
  return (
    <>
      <M.IconButton onClick={openEditor} title="Edit meta" size="small">
        <M.Icon fontSize="inherit" color={color}>
          list
        </M.Icon>
      </M.IconButton>

      <Dialog
        name={name}
        onChange={onChange}
        onClose={closeEditor}
        open={open}
        value={value}
      />
    </>
  )
}

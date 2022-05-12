import * as React from 'react'
import * as M from '@material-ui/core'

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

interface EditFileMetaProps {
  name: string
  onChange: (value: JsonValue) => void
  onClose: () => void
  open: boolean
  value: JsonValue
}

export default function EditFileMeta({
  name,
  onChange,
  onClose,
  open,
  value,
}: EditFileMetaProps) {
  // TODO: show "modified" state
  //       possible solution: store value and its state in one object `metaValue = { value, state }`
  // TODO: add button to reset innerValue
  const [innerValue, setInnerValue] = React.useState(value)
  const classes = useStyles()
  const dialogClasses = useDialogStyles()
  const [isRaw, setRaw] = React.useState(false)
  const handleSubmit = React.useCallback(() => {
    onChange(innerValue)
    onClose()
  }, [innerValue, onChange, onClose])
  const handleCancel = React.useCallback(() => {
    setInnerValue(value)
    onClose()
  }, [onClose, value])
  return (
    <M.Dialog
      fullWidth
      maxWidth="xl"
      onClose={handleCancel}
      open={open}
      classes={dialogClasses}
    >
      <M.DialogTitle>Object-level metadata for "{name}"</M.DialogTitle>
      <M.DialogContent>
        <MetadataEditor
          multiColumned
          isRaw={isRaw}
          value={innerValue}
          onChange={setInnerValue}
        />
      </M.DialogContent>
      <M.DialogActions>
        <M.FormControlLabel
          className={classes.switch}
          control={<M.Switch checked={isRaw} onChange={() => setRaw(!isRaw)} />}
          label="Edit as JSON"
        />
        <M.Button onClick={handleCancel}>Discard</M.Button>
        <M.Button onClick={handleSubmit} variant="contained" color="primary">
          Save
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

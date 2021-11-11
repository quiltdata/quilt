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
      <M.DialogTitle>
        Metadata for <Code>{name}</Code>
      </M.DialogTitle>
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
          label="Edit raw data"
        />
        <M.Button onClick={handleCancel}>Discard</M.Button>
        <M.Button onClick={handleSubmit} variant="contained" color="primary">
          Save
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface MetadataIconProps {
  color: M.PropTypes.Color | 'disabled'
}

function MetadataIcon({ color }: MetadataIconProps) {
  return (
    <M.Icon fontSize="inherit" color={color}>
      list
    </M.Icon>
  )
}

interface EditMetaProps {
  name: string
  value: JsonValue
  onChange?: (value: JsonValue) => void
}

export default function EditFileMeta({ name, value, onChange }: EditMetaProps) {
  // TODO: move innerValue from Dialog here and:
  //       1. add button to reset innerValue
  //       2. show "modified" state
  const [open, setOpen] = React.useState(false)
  const closeEditor = React.useCallback(() => setOpen(false), [setOpen])
  const openEditor = React.useCallback(() => setOpen(true), [setOpen])
  // TODO: simplify R.isEmpty when meta will be normalized to null
  const color = React.useMemo(() => (R.isEmpty(value) ? 'inherit' : 'primary'), [value])

  if (!onChange) {
    return (
      <M.IconButton size="small" disabled>
        <MetadataIcon color="disabled" />
      </M.IconButton>
    )
  }

  return (
    <>
      <M.IconButton onClick={openEditor} title="Edit meta" size="small">
        <MetadataIcon color={color} />
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

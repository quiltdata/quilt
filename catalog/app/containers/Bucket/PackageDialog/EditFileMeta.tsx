import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import MetadataEditor from 'components/MetadataEditor'
import type * as Model from 'model'
import type { JsonRecord } from 'utils/types'

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

function formatObjectMeta(
  objectMeta?: Model.EntryMeta,
  userMeta?: JsonRecord,
): Model.EntryMeta | undefined {
  if (objectMeta === undefined && userMeta === undefined) return undefined
  if (userMeta === undefined) return objectMeta
  return { ...objectMeta, user_meta: userMeta }
}

function getUserMeta(objectMeta?: Model.EntryMeta) {
  return objectMeta?.user_meta
}

interface DialogProps {
  name: string
  onChange: (value?: Model.EntryMeta) => void
  onClose: () => void
  open: boolean
  value?: Model.EntryMeta
}

function Dialog({ name, onChange, onClose, open, value }: DialogProps) {
  // TODO: add button to reset innerValue
  const [userMeta, setUserMeta] = React.useState(getUserMeta(value))
  const classes = useStyles()
  const dialogClasses = useDialogStyles()
  const [isRaw, setRaw] = React.useState(false)
  const handleSubmit = React.useCallback(() => {
    onChange(formatObjectMeta(value, userMeta))
    onClose()
  }, [userMeta, onChange, onClose, value])
  const handleCancel = React.useCallback(() => {
    setUserMeta(getUserMeta(value))
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
          value={userMeta}
          onChange={setUserMeta}
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

interface MetadataIconProps {
  color?: M.PropTypes.Color
}

function MetadataIcon({ color }: MetadataIconProps) {
  return (
    <M.Icon fontSize="inherit" color={color}>
      list
    </M.Icon>
  )
}

interface EditMetaProps {
  disabled?: boolean
  name: string
  onChange: (value?: Model.EntryMeta) => void
  value?: Model.EntryMeta
  state?: string
}

export default function EditFileMeta({
  disabled,
  name,
  state,
  value,
  onChange,
}: EditMetaProps) {
  // TODO: show "modified" state
  const [open, setOpen] = React.useState(false)
  const closeEditor = React.useCallback(() => setOpen(false), [setOpen])
  const openEditor = React.useCallback(() => setOpen(true), [setOpen])
  // TODO: simplify R.isEmpty when meta will be normalized to null
  const color = React.useMemo(
    () =>
      state === 'invalid' || R.isEmpty(value) || R.isNil(value) ? 'inherit' : 'primary',
    [state, value],
  )

  if (disabled) {
    return (
      <M.IconButton size="small" disabled>
        <MetadataIcon />
      </M.IconButton>
    )
  }

  return (
    <>
      <M.IconButton color="inherit" onClick={openEditor} title="Edit meta" size="small">
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

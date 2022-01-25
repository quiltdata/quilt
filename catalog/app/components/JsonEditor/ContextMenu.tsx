import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonValue } from './constants'

interface ContextMenuProps {
  anchorEl: HTMLElement
  open: boolean
  onChange: (value: JsonValue) => void
  onClose: () => void
  value: JsonValue
}

export default function ContextMenu({
  anchorEl,
  open,
  onChange,
  onClose,
  value,
}: ContextMenuProps) {
  const bootstrapObject = React.useCallback(() => {
    onChange({})
    onClose()
  }, [onChange, onClose])
  const bootstrapArray = React.useCallback(() => {
    onChange([])
    onClose()
  }, [onChange, onClose])
  const convertToNumber = React.useCallback(() => {
    onChange(Number(value))
    onClose()
  }, [onChange, onClose, value])
  const convertToString = React.useCallback(() => {
    onChange(value.toString())
    onClose()
  }, [onChange, onClose, value])

  return (
    <M.Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      <M.Box px={2} pb={1}>
        <M.Typography variant="subtitle1" style={{ marginBottom: '8px' }}>
          Bootstrap value as:
        </M.Typography>
        <M.ButtonGroup variant="outlined" size="small">
          <M.Button startIcon={<M.Icon>data_object</M.Icon>} onClick={bootstrapObject}>
            Object
          </M.Button>
          <M.Button startIcon={<M.Icon>data_array</M.Icon>} onClick={bootstrapArray}>
            Array
          </M.Button>
        </M.ButtonGroup>
      </M.Box>
      <M.Divider />
      <M.Box mt={2} px={2} pb={1}>
        <M.Typography variant="subtitle1" style={{ marginBottom: '8px' }}>
          Convert to:
        </M.Typography>
        <M.ButtonGroup variant="outlined" size="small">
          <M.Button startIcon={<M.Icon>filter_1</M.Icon>} onClick={convertToNumber}>
            Number
          </M.Button>
          <M.Button startIcon={<M.Icon>abc</M.Icon>} onClick={convertToString}>
            String
          </M.Button>
        </M.ButtonGroup>
      </M.Box>
    </M.Menu>
  )
}

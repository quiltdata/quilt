import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonValue, EMPTY_VALUE } from './constants'

const isNumber = (v: any) => typeof v === 'number' && !Number.isNaN(v)

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
    onChange(`${value}`)
    onClose()
  }, [onChange, onClose, value])

  const isConvertibleToNumber = React.useMemo(() => {
    try {
      return !isNumber(value) && isNumber(Number(value))
    } catch (error) {
      return false
    }
  }, [value])
  const isConvertibleToString = React.useMemo(() => typeof value !== 'string', [value])
  const isConvertible = React.useMemo(
    () => value !== EMPTY_VALUE && (isConvertibleToNumber || isConvertibleToString),
    [value, isConvertibleToNumber, isConvertibleToString],
  )

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

      {isConvertible && (
        <M.Box px={2} pt={2} pb={1}>
          <M.Divider />

          <M.Typography variant="subtitle1" style={{ marginBottom: '8px' }}>
            Convert to:
          </M.Typography>
          <M.ButtonGroup variant="outlined" size="small">
            {isConvertibleToNumber && (
              <M.Button startIcon={<M.Icon>filter_1</M.Icon>} onClick={convertToNumber}>
                Number
              </M.Button>
            )}
            {isConvertibleToString && (
              <M.Button startIcon={<M.Icon>abc</M.Icon>} onClick={convertToString}>
                String
              </M.Button>
            )}
          </M.ButtonGroup>
        </M.Box>
      )}
    </M.Menu>
  )
}

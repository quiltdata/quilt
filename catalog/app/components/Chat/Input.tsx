import * as React from 'react'
import * as M from '@material-ui/core'

interface ChatInputProps {
  className?: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  value: string
}

export default function ChatInput({
  className,
  disabled,
  onChange,
  onSubmit,
  value,
}: ChatInputProps) {
  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      if (!value || disabled) return
      onSubmit()
    },
    [disabled, onSubmit, value],
  )
  return (
    <form onSubmit={handleSubmit}>
      <M.TextField
        autoFocus
        className={className}
        disabled={disabled}
        fullWidth
        label="Chat"
        onChange={(e) => onChange(e.target.value)}
        size="small"
        value={value}
        variant="outlined"
        InputProps={{
          endAdornment: (
            <M.InputAdornment position="end">
              <M.IconButton disabled={!value} onClick={onSubmit} type="submit">
                <M.Icon>send</M.Icon>
              </M.IconButton>
            </M.InputAdornment>
          ),
        }}
      />
    </form>
  )
}

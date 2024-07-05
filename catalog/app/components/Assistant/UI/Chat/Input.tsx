import * as React from 'react'
import * as M from '@material-ui/core'

interface ChatInputProps {
  className?: string
  disabled?: boolean
  onSubmit: (value: string) => void
}

export default function ChatInput({ className, disabled, onSubmit }: ChatInputProps) {
  const [value, setValue] = React.useState('')

  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      if (!value || disabled) return
      onSubmit(value)
      setValue('')
    },
    [disabled, onSubmit, value],
  )
  return (
    <form onSubmit={handleSubmit}>
      <M.TextField
        autoFocus
        className={className}
        // disabled={disabled}
        fullWidth
        helperText="Qurator may make errors. Verify critical information yourself."
        label="Chat"
        onChange={(e) => setValue(e.target.value)}
        size="small"
        value={value}
        variant="outlined"
        InputProps={{
          endAdornment: (
            <M.InputAdornment position="end">
              <M.IconButton
                disabled={disabled || !value}
                onClick={handleSubmit}
                type="submit"
              >
                <M.Icon>send</M.Icon>
              </M.IconButton>
            </M.InputAdornment>
          ),
        }}
      />
    </form>
  )
}

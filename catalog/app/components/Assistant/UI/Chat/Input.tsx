import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  input: {
    alignItems: 'center',
    display: 'flex',
    padding: `${t.spacing(2)}px`,
    paddingRight: `${t.spacing(1)}px`,
  },
}))

interface ChatInputProps {
  className?: string
  disabled?: boolean
  onSubmit: (value: string) => void
}

export default function ChatInput({ className, disabled, onSubmit }: ChatInputProps) {
  const classes = useStyles()

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
    <form className={cx(classes.input, className)} onSubmit={handleSubmit}>
      <M.OutlinedInput
        onChange={(e) => setValue(e.target.value)}
        value={value}
        autoFocus
        fullWidth
        margin="dense"
        placeholder="Type a message..."
      />
      <M.IconButton
        disabled={disabled || !value}
        onClick={handleSubmit}
        type="submit"
        color="primary"
      >
        <M.Icon>send</M.Icon>
      </M.IconButton>
    </form>
  )
}

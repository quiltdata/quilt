import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  input: {
    alignItems: 'center',
    display: 'flex',
    paddingLeft: `${t.spacing(2)}px`,
    paddingRight: `${t.spacing(2)}px`,
  },
  textField: {
    marginTop: 0,
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

  // TODO: customize colors
  return (
    <form className={cx(classes.input, className)} onSubmit={handleSubmit}>
      <M.TextField
        className={classes.textField}
        onChange={(e) => setValue(e.target.value)}
        value={value}
        variant="filled"
        autoFocus
        fullWidth
        margin="normal"
        label="Ask Qurator"
        helperText="Qurator may make errors. Verify important information."
        InputProps={{
          endAdornment: (
            <M.InputAdornment position="end" variant="filled">
              <M.IconButton
                disabled={disabled || !value}
                onClick={handleSubmit}
                type="submit"
                color="primary"
                edge="end"
              >
                <M.Icon>send</M.Icon>
              </M.IconButton>
            </M.InputAdornment>
          ),
        }}
        InputLabelProps={{}}
      />
    </form>
  )
}

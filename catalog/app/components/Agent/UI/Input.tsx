import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { createCustomAppTheme } from 'constants/style'

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
  hint: {
    color: t.palette.text.hint,
  },
}))

const backgroundColor = M.colors.indigo[900]
const backgroundColorLt = M.lighten(backgroundColor, 0.1)

const useInputStyles = M.makeStyles({
  focused: {},
  disabled: {},
  root: {
    backgroundColor,
    borderRadius: '8px',
    color: M.fade(M.colors.common.white, 0.8),
    '&:hover': {
      backgroundColor: backgroundColorLt,
      // Reset on touch devices, it doesn't add specificity
      '@media (hover: none)': {
        backgroundColor,
      },
    },
    '&$focused': {
      backgroundColor,
    },
    '&$disabled': {
      backgroundColor: backgroundColorLt,
    },
  },
})

const useLabelStyles = M.makeStyles({
  focused: {},
  root: {
    color: M.fade(M.colors.common.white, 0.6),
    '&$focused': {
      color: M.fade(M.colors.common.white, 0.6),
    },
  },
})

const darkTheme = createCustomAppTheme({ palette: { type: 'dark' } } as any)

interface InputProps {
  className?: string
  disabled?: boolean
  onSubmit: (value: string) => void
  label?: string
  helperText?: string
}

export default function Input({
  className,
  disabled,
  onSubmit,
  label = 'Ask Agent',
  helperText = 'Agent may make errors. Verify important information.',
}: InputProps) {
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
      <M.ThemeProvider theme={darkTheme}>
        <M.TextField
          className={classes.textField}
          onChange={(e) => setValue(e.target.value)}
          value={value}
          variant="filled"
          autoFocus
          fullWidth
          margin="normal"
          label={label}
          helperText={helperText}
          InputProps={{
            disableUnderline: true,
            classes: useInputStyles(),
            endAdornment: (
              <M.InputAdornment position="end">
                <M.IconButton
                  disabled={disabled || !value}
                  onClick={handleSubmit}
                  type="submit"
                  edge="end"
                >
                  <M.Icon style={{ opacity: 0.7 }}>send</M.Icon>
                </M.IconButton>
              </M.InputAdornment>
            ),
          }}
          InputLabelProps={{ classes: useLabelStyles() }}
          FormHelperTextProps={{ classes: { root: classes.hint } }}
        />
      </M.ThemeProvider>
    </form>
  )
}

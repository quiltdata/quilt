import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Layout from './Layout'
import * as PasswordStrength from './PasswordStrength'

const useWeakPasswordIconStyles = M.makeStyles((t) => ({
  icon: {
    color: t.palette.warning.dark,
  },
}))

function WeakPasswordIcon() {
  const classes = useWeakPasswordIconStyles()
  return (
    <M.Tooltip title="Password is too weak">
      <M.Icon className={classes.icon} fontSize="small" color="inherit">
        error_outline
      </M.Icon>
    </M.Tooltip>
  )
}

interface PasswordFieldProps {
  errors: Record<string, React.ReactNode>
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
  email: string
  username: string
}

export default function PasswordField({
  input,
  email,
  username,
  ...rest
}: PasswordFieldProps) {
  const { value } = input
  const strength = PasswordStrength.useStrength(value, { email, username })
  const isWeak = Number(strength?.score) <= 2
  const helperText = strength?.feedback.suggestions.length
    ? `Hint: ${strength?.feedback.suggestions.join(' ')}`
    : ''
  return (
    <>
      {/* @ts-expect-error */}
      <Layout.Field
        InputProps={{
          endAdornment: isWeak && (
            <M.InputAdornment position="end">
              <WeakPasswordIcon />
            </M.InputAdornment>
          ),
        }}
        helperText={helperText}
        type="password"
        floatingLabelText="Password"
        {...input}
        {...rest}
      />
      <PasswordStrength.Indicator strength={strength} />
    </>
  )
}

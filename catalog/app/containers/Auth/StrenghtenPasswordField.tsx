import cx from 'classnames'
import * as React from 'react'
import * as RF from 'react-final-form'
import zxcvbn from 'zxcvbn'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles/colorManipulator'

import * as Layout from './Layout'

const useStyles = M.makeStyles((t) => ({
  root: {
    backgroundColor: t.palette.divider,
    height: t.spacing(0.5),
    position: 'relative',
    transition: '.3s ease background-color',
    '&:after': {
      bottom: 0,
      content: '""',
      left: 0,
      position: 'absolute',
      top: 0,
      transition: '.3s ease background-color, .3s ease width',
    },
    '&$tooGuessable': {
      backgroundColor: fade(t.palette.error.dark, 0.3),
    },
    '&$tooGuessable:after': {
      backgroundColor: t.palette.error.dark,
      width: '10%',
    },
    '&$veryGuessable': {
      backgroundColor: fade(t.palette.error.main, 0.3),
    },
    '&$veryGuessable:after': {
      backgroundColor: t.palette.error.main,
      width: '33%',
    },
    '&$somewhatGuessable': {
      backgroundColor: fade(t.palette.warning.dark, 0.3),
    },
    '&$somewhatGuessable:after': {
      backgroundColor: t.palette.warning.dark,
      width: '55%',
    },
    '&$safelyUnguessable': {
      backgroundColor: fade(t.palette.success.light, 0.3),
    },
    '&$safelyUnguessable:after': {
      backgroundColor: t.palette.success.light,
      width: '78%',
    },
    '&$veryUnguessable': {
      backgroundColor: fade(t.palette.success.dark, 0.3),
    },
    '&$veryUnguessable:after': {
      backgroundColor: t.palette.success.dark,
      width: '100%',
    },
  },
  tooGuessable: {},
  veryGuessable: {},
  somewhatGuessable: {},
  safelyUnguessable: {},
  veryUnguessable: {},
}))

type PasswordStrength = zxcvbn.ZXCVBNResult | null

export function useStrength(
  value: string,
  { email, username }: Record<string, string>,
): PasswordStrength {
  return React.useMemo(() => {
    if (!value) return null

    const inputs = ['quilt', 'quiltdata', 'quiltdata.io']
    if (email) inputs.push(email)
    if (username) inputs.push(username)

    const result = zxcvbn(value, inputs)

    if (value.includes('quilt')) {
      result.feedback.suggestions.push('Avoid using website name in password')
    }
    if (value.includes(email)) {
      result.feedback.suggestions.push('Avoid re-using email in password')
    }
    if (value.includes(username)) {
      result.feedback.suggestions.push('Avoid re-using username in password')
    }

    return result
  }, [email, username, value])
}

interface IndicatorProps {
  strength: PasswordStrength
}

type ScoreState =
  | 'tooGuessable'
  | 'veryGuessable'
  | 'somewhatGuessable'
  | 'safelyUnguessable'
  | 'veryUnguessable'

const ScoreMap: ScoreState[] = [
  'tooGuessable',
  'veryGuessable',
  'somewhatGuessable',
  'safelyUnguessable',
  'veryUnguessable',
]

export function Indicator({ strength }: IndicatorProps) {
  const classes = useStyles()
  const stateClassName = strength ? classes[ScoreMap[strength.score]] : ''
  return <div className={cx(classes.root, stateClassName)} />
}

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
  const strength = useStrength(value, { email, username })
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
      <Indicator strength={strength} />
    </>
  )
}

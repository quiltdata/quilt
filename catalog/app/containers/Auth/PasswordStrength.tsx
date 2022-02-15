import cx from 'classnames'
import * as React from 'react'
import zxcvbn from 'zxcvbn'
import { fade } from '@material-ui/core/styles/colorManipulator'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    backgroundColor: fade(t.palette.error.main, 0.3),
    '&$tooGuessable': {
      backgroundColor: fade(t.palette.error.dark, 0.3),
    },
    '&$veryGuessable': {
      backgroundColor: fade(t.palette.error.main, 0.3),
    },
    '&$somewhatGuessable': {
      backgroundColor: fade(t.palette.warning.dark, 0.3),
    },
    '&$safelyUnguessable': {
      backgroundColor: fade(t.palette.success.light, 0.3),
    },
    '&$veryUnguessable': {
      backgroundColor: fade(t.palette.success.dark, 0.3),
    },
  },
  inner: {
    backgroundColor: t.palette.error.main,
    transition: '.3s ease width, .3s ease background-color, .3s ease height',
    height: t.spacing(0.5),
    width: 0,
    '&$tooGuessable': {
      backgroundColor: t.palette.error.dark,
      width: '10%',
    },
    '&$veryGuessable': {
      backgroundColor: t.palette.error.main,
      width: '33%',
    },
    '&$somewhatGuessable': {
      backgroundColor: t.palette.warning.dark,
      width: '55%',
    },
    '&$safelyUnguessable': {
      backgroundColor: t.palette.success.light,
      width: '78%',
    },
    '&$veryUnguessable': {
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

interface PasswordStrengthProps {
  className?: string
  value: string
}

type Strength =
  | 'tooGuessable'
  | 'veryGuessable'
  | 'somewhatGuessable'
  | 'safelyUnguessable'
  | 'veryUnguessable'

const ScoreMap: Strength[] = [
  'tooGuessable',
  'veryGuessable',
  'somewhatGuessable',
  'safelyUnguessable',
  'veryUnguessable',
]

export default function PasswordStrength({ className, value }: PasswordStrengthProps) {
  const classes = useStyles()
  const result: zxcvbn.ZXCVBNResult = zxcvbn(value)
  const stateClassName = classes[ScoreMap[result.score]]
  return (
    <div className={cx(classes.root, stateClassName, className)}>
      <div className={cx(classes.inner, stateClassName)} />
    </div>
  )
}

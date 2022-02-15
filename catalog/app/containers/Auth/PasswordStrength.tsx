import cx from 'classnames'
import * as React from 'react'
import zxcvbn from 'zxcvbn'
import { fade } from '@material-ui/core/styles/colorManipulator'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
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

export function useScore(value: string): zxcvbn.ZXCVBNScore {
  return React.useMemo(() => {
    const { score }: zxcvbn.ZXCVBNResult = zxcvbn(value)
    return score
  }, [value])
}

interface PasswordStrengthProps {
  className?: string
  score: zxcvbn.ZXCVBNScore
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

export function Indicator({ className, score }: PasswordStrengthProps) {
  const classes = useStyles()
  return <div className={cx(classes.root, classes[ScoreMap[score]], className)} />
}

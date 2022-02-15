import cx from 'classnames'
import * as React from 'react'
import zxcvbn from 'zxcvbn'
import { fade } from '@material-ui/core/styles/colorManipulator'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    transition: '.3s ease background-color',
  },
  inner: {
    transition: '.3s ease width, .3s ease background-color',
    height: t.spacing(0.5),
  },
}))

function getStyles(
  t: M.Theme,
  score: zxcvbn.ZXCVBNScore,
): { color: string; width: number } {
  switch (score) {
    case 4:
      return {
        color: t.palette.success.dark,
        width: 100,
      }
    case 3:
      return {
        color: t.palette.success.light,
        width: 78,
      }
    case 2:
      return {
        color: t.palette.warning.dark,
        width: 55,
      }
    case 1:
      return {
        color: t.palette.error.main,
        width: 33,
      }
    case 0:
      return {
        color: t.palette.error.dark,
        width: 10,
      }
    default:
      return {
        color: 'transparent',
        width: 0,
      }
  }
}

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

export function Indicator({ className, score }: PasswordStrengthProps) {
  const t = M.useTheme()
  const classes = useStyles()
  const { color, width } = React.useMemo(() => getStyles(t, score), [t, score])
  return (
    <div
      className={cx(classes.root, className)}
      style={{ backgroundColor: fade(color, 0.3) }}
    >
      <div
        className={cx(classes.inner)}
        style={{ backgroundColor: color, width: `${width}%` }}
      />
    </div>
  )
}

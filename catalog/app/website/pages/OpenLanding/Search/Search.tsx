import * as React from 'react'
import * as M from '@material-ui/core'

import img2x from 'utils/img2x'

import Dots from 'website/components/Backgrounds/Dots'

import Suggestions from './Suggestions'
import useState from './State'

import bg from './search-bg.png'
import bg2x from './search-bg@2x.png'

const useHelpStyles = M.makeStyles((t) => ({
  paper: {
    borderRadius: t.spacing(0.5),
    marginTop: t.spacing(10.5),
    maxWidth: t.spacing(111),
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
}))

const useInputStyles = M.makeStyles((t) => ({
  root: {
    animation: '$slideDown 0.3s ease',
    background: t.palette.common.white,
    borderRadius: t.typography.pxToRem(40),
    color: t.palette.getContrastText(t.palette.common.white),
    fontSize: t.typography.pxToRem(30),
    lineHeight: t.typography.pxToRem(80),
    maxWidth: 960,
    overflow: 'hidden',
    paddingLeft: 0,
    width: '100%',
  },
  input: {
    height: 'auto',
    padding: t.spacing(0, 4, 0, 10),
  },
}))

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  container: {
    position: 'relative',
    '&::before': {
      animation: '$appear 0.3s ease',
      background: `center no-repeat url(${img2x(bg, bg2x)})`,
      bottom: 0,
      content: '""',
      left: 0,
      opacity: 0.5,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  },
  inner: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: 910,
    position: 'relative',
    [t.breakpoints.down('xs')]: {
      paddingTop: t.spacing(20),
    },
  },
  inputWrapper: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
  },
  adornment: {
    justifyContent: 'center',
    position: 'absolute',
    height: 'auto',
    maxHeight: '100%',
  },
  icon: {
    fontSize: 'inherit',
    marginLeft: t.spacing(4),
    opacity: 0.5,
  },

  '@keyframes slideDown': {
    '0%': {
      opacity: 0.7,
      transform: 'translateY(-10px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateY(0px)',
    },
  },

  '@keyframes appear': {
    '0%': {
      transform: 'scale(0.95)',
    },
    '100%': {
      transform: 'scale(1)',
    },
  },
}))

export default function Search() {
  const classes = useStyles()
  const helpClasses = useHelpStyles()
  const inputClasses = useInputStyles()

  const { helpOpen, input, onClickAway, suggestions } = useState()
  const ref = React.useRef<HTMLInputElement>(null)
  const focus = React.useCallback(() => ref.current?.focus(), [])

  return (
    <div className={classes.root}>
      <Dots />
      <M.Container maxWidth="lg" className={classes.container}>
        <div className={classes.inner}>
          <M.ClickAwayListener onClickAway={onClickAway}>
            <div className={classes.inputWrapper}>
              <M.InputBase
                {...input}
                classes={inputClasses}
                placeholder="Search"
                ref={ref}
                startAdornment={
                  <M.InputAdornment className={classes.adornment} position="start">
                    <M.Icon className={classes.icon} onClick={focus}>
                      search
                    </M.Icon>
                  </M.InputAdornment>
                }
              />
              <Suggestions
                classes={helpClasses}
                open={helpOpen}
                suggestions={suggestions}
              />
            </div>
          </M.ClickAwayListener>
        </div>
      </M.Container>
    </div>
  )
}

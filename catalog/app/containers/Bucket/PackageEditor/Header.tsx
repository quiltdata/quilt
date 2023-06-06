import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as State from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    height: t.spacing(8),
  },
  button: {
    marginLeft: 'auto',
  },
  container: {
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(8),
    padding: t.spacing(0),
    transition: 'padding 0.15s',
  },
  errors: {
    marginLeft: t.spacing(2),
  },
  sticky: {
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: t.zIndex.appBar + 1,
    '& $container': {
      background: t.palette.background.paper,
      borderRadius: `0 0 ${t.shape.borderRadius} ${t.shape.borderRadius}`,
      boxShadow: t.shadows[8],
      padding: t.spacing(0, 2),
    },
  },
  stickyToWindow: {
    transform: 'translateY(0)',
    transition: 'transform 0.15s',
  },
  stickToHeader: {
    transform: `translateY(${t.spacing(8)}px)`,
  },
  title: {
    ...t.typography.h4,
  },
}))

const INLINE = Symbol('inline')

const STICK_TO_WINDOW = Symbol('Stick to window')

const STICK_TO_HEADER = Symbol('Stick to header')

type Visibility = typeof INLINE | typeof STICK_TO_WINDOW | typeof STICK_TO_HEADER

function calcVisibility(scrollY: number, isHeaderHidden: boolean): Visibility {
  if (scrollY < 64) {
    return INLINE
  } else if (isHeaderHidden) {
    return STICK_TO_WINDOW
  } else {
    return STICK_TO_HEADER
  }
}

function useVisibility() {
  const trigger = M.useScrollTrigger()
  const [visibility, setVisibility] = React.useState<Visibility>(INLINE)
  const handleScroll = React.useCallback(() => {
    const newVisibility = calcVisibility(window.scrollY, trigger)
    if (visibility !== newVisibility) setVisibility(newVisibility)
  }, [trigger, visibility])
  React.useEffect(() => {
    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  return visibility
}

interface HeaderProps {
  error?: string
  visibility: Visibility
  disabled: boolean
  onSubmit: () => void
}

function Header({ error, visibility, disabled, onSubmit }: HeaderProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <div
        className={cx({
          [classes.sticky]: visibility !== INLINE,
          [classes.stickyToWindow]: visibility === STICK_TO_WINDOW,
          [classes.stickToHeader]: visibility === STICK_TO_HEADER,
        })}
      >
        <M.Container maxWidth="lg" disableGutters={visibility === INLINE}>
          <div className={classes.container}>
            <M.Typography className={classes.title}>Curate package</M.Typography>
            {error && (
              <Lab.Alert className={classes.errors} severity="error">
                {error}
              </Lab.Alert>
            )}
            <M.Button
              className={classes.button}
              color="primary"
              disabled={disabled}
              onClick={onSubmit}
              variant="contained"
            >
              <M.Icon>publish</M.Icon>Create
            </M.Button>
          </div>
        </M.Container>
      </div>
    </div>
  )
}

export default function HeaderContainer() {
  const { fields, main } = State.use()
  const error = React.useMemo(() => {
    if (!Array.isArray(main.state.status)) return
    return main.state.status.map(({ message }) => message).join('; ')
  }, [main.state.status])
  const visibility = useVisibility()
  const disabled = React.useMemo(
    () => main.getters.disabled(fields),
    [fields, main.getters],
  )
  return (
    <Header
      disabled={disabled}
      error={error}
      onSubmit={() => main.actions.onSubmit(fields)}
      visibility={visibility}
    />
  )
}

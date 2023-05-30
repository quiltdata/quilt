import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { L } from 'components/Form/Package/types'

import * as State from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    height: t.spacing(8),
  },
  title: {
    ...t.typography.h4,
    marginRight: 'auto',
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
  container: {
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(8),
    padding: t.spacing(0),
    transition: 'padding 0.15s',
  },
}))

const INLINE = Symbol('inline')

const STICK_TO_WINDOW = Symbol('Stick to window')

const STICK_TO_HEADER = Symbol('Stick to header')

type Visibility = typeof INLINE | typeof STICK_TO_WINDOW | typeof STICK_TO_HEADER

function useVisibility() {
  const trigger = M.useScrollTrigger()
  const [visibility, setVisibility] = React.useState<Visibility>(INLINE)
  const handleScroll = React.useCallback(() => {
    if (window.scrollY < 64) {
      if (visibility !== INLINE) setVisibility(INLINE)
    } else if (trigger) {
      if (visibility !== STICK_TO_WINDOW) setVisibility(STICK_TO_WINDOW)
    } else {
      if (visibility !== STICK_TO_HEADER) setVisibility(STICK_TO_HEADER)
    }
  }, [trigger, visibility])
  React.useEffect(() => {
    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  return visibility
}

function useDisabled() {
  const { message, name, workflow } = State.use()
  return React.useMemo(() => {
    if (name.state === L) return true
    if (name.state.errors === L || name.state.errors?.length || name.state.warnings === L)
      return true

    if (message.state.errors?.length) return true

    if (workflow.state === L || workflow.state.errors?.length) return true

    return false
  }, [name.state, message.state, workflow.state])
}

export default function Header() {
  const classes = useStyles()
  const { main } = State.use()
  const visibility = useVisibility()
  const disabled = useDisabled()
  const handleSubmit = React.useCallback(() => {
    // TODO: if disabled - reveal errors, don't actually submit
    main.actions.onSubmit()
  }, [main.actions])
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
            <M.Button
              color="primary"
              disabled={main.state && disabled}
              onClick={handleSubmit}
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

/*
div wrapper
  div sticky
    container
*/

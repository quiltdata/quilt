import * as React from 'react'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'

import SUBSCRIPTION_QUERY from './gql/Subscription.generated'

interface SubscriptionState {
  invalid: boolean
  dismissed: boolean
  dismiss: () => void
  restore: () => void
}

export function useState(): SubscriptionState {
  const data = GQL.useQuery(SUBSCRIPTION_QUERY)

  const invalid = GQL.fold(data, {
    fetching: () => false,
    error: () => false,
    data: (d) => !d.subscription.active,
  })

  const [dismissed, setDismissedState] = React.useState(
    () => window.sessionStorage.getItem('quilt-license-error-dismissed') === 'true',
  )

  const setDismissed = React.useCallback(
    (value: boolean) => {
      window.sessionStorage.setItem(
        'quilt-license-error-dismissed',
        JSON.stringify(value),
      )
      setDismissedState(value)
    },
    [setDismissedState],
  )

  const dismiss = React.useCallback(() => {
    setDismissed(true)
  }, [setDismissed])

  const restore = React.useCallback(() => {
    setDismissed(false)
  }, [setDismissed])

  return {
    invalid,
    dismissed,
    dismiss,
    restore,
  }
}

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: t.palette.error.main,
    color: t.palette.error.contrastText,
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 1,

    [t.breakpoints.down('sm')]: {
      justifyContent: 'space-between',
      paddingLeft: t.spacing(1.5),
      paddingRight: t.spacing(1.5),
    },
  },
  msg: {
    display: 'inline-block',
    paddingRight: t.spacing(2),
    ...t.typography.h6,

    [t.breakpoints.down('sm')]: {
      ...t.typography.body2,
    },

    '& br': {
      display: 'none',
      [t.breakpoints.down('sm')]: {
        display: 'inline',
      },
    },
  },
}))

export function Display(props: SubscriptionState) {
  const classes = useStyles()
  return (
    <M.Slide
      direction="down"
      in={props.invalid && !props.dismissed}
      mountOnEnter
      unmountOnExit
    >
      <div className={classes.root}>
        <span className={classes.msg}>
          This Quilt stack is unlicensed.
          <br /> Contact your Quilt administrator.
        </span>
        <M.Button onClick={props.dismiss} variant="outlined">
          Dismiss
        </M.Button>
      </div>
    </M.Slide>
  )
}

import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

const Ctx = React.createContext<{
  state: boolean
  adjustCounter: (inc: number) => void
} | null>(null)

interface FullWidthProviderProps {
  children: React.ReactNode
}

export function FullWidthProvider({ children }: FullWidthProviderProps) {
  const [state, setState] = React.useState(false)
  const counterRef = React.useRef(0)
  const adjustCounter = React.useCallback((inc: number) => {
    counterRef.current += inc
    setState(counterRef.current > 0)
  }, [])
  return <Ctx.Provider value={{ state, adjustCounter }}>{children}</Ctx.Provider>
}

export function useSetFullWidth() {
  const ctx = React.useContext(Ctx)
  invariant(ctx, 'Context must be used within a Provider')
  const { adjustCounter } = ctx
  React.useEffect(() => {
    adjustCounter(1)
    return () => {
      adjustCounter(-1)
    }
  }, [adjustCounter])
}

export function useGetFullWidth() {
  const ctx = React.useContext(Ctx)
  invariant(ctx, 'Context must be used within a Provider')
  return ctx.state
}

const useStyles = M.makeStyles((t) => ({
  fullWidth: {
    animation: t.transitions.create('$expand'),
  },
  contained: {
    animation: t.transitions.create('$collapse'),
  },
  '@keyframes expand': {
    '0%': {
      transform: 'scaleX(0.94)',
    },
    '100%': {
      transform: 'scaleX(1)',
    },
  },
  '@keyframes collapse': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: 1,
    },
  },
}))

export function Container({ children, className }: M.ContainerProps) {
  const classes = useStyles()

  const fullWidth = useGetFullWidth()

  return (
    <M.Container
      className={cx(fullWidth ? classes.fullWidth : classes.contained, className)}
      maxWidth={!fullWidth && 'lg'}
    >
      {children}
    </M.Container>
  )
}

export default Container

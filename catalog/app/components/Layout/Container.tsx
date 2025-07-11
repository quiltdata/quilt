import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'

const Ctx = React.createContext<
  [boolean, React.Dispatch<React.SetStateAction<boolean>>] | null
>(null)

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const value = React.useState(false)
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFullWidth() {
  const counter = React.useRef(0)
  React.useEffect(() => {
    invariant(
      !counter.current,
      'Hook intended to set `fullWidth: true` only once. If you need a different behaviour, please, consider using different implementation.',
    )
    counter.current += 1
  }, [])

  const ctx = React.useContext(Ctx)
  invariant(ctx, 'Context must be used within a Provider')
  const [, setFullWidth] = ctx

  React.useEffect(() => {
    setFullWidth(true)
    return () => setFullWidth(false)
  }, [setFullWidth])
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

  const ctx = React.useContext(Ctx)
  invariant(ctx, 'Context must be used within a Provider')
  const [fullWidth] = ctx

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

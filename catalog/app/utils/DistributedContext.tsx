import invariant from 'invariant'
import * as React from 'react'
import * as uuid from 'uuid'

interface DistributedContext<I> {
  provide: (value: I) => () => void
  counter: number
  collect: () => I[]
}

/**
 * Creates a set of React components and hooks for a "distributed" context.
 * This allows multiple components in a tree to provide values, which are then
 * aggregated for consumers using a combiner function. It's useful for
 * implementing overridable configurations, feature flags, etc.
 *
 * **Example**:
 *
 * ```
 * import DistributedContext from 'utils/DistributedContext'
 *
 * // Create a context that allows you to push boolean values.
 * const FlagContext = DistributedContext<boolean>()
 * const FlagProvider = FlagContext.Provider
 * // The combined value will be true if at least one of the pushed values is true.
 * const useGetFlag = FlagContext.makeCombinator((values) => values.includes(true))
 * const useSetFlag = FlagContext.useProvide
 *
 * function ConsumerComponent() {
 *   const flag = useGetFlag()
 *   return <div>{`Combined value is: ${flag}`}</div>
 * }
 *
 * function ProviderComponent() {
 *   useSetFlag(true)
 *   return <>sup</>
 * }
 *
 * function Main() {
 *   return (
 *     <FlagProvider>
 *       <ConsumerComponent /> // This will display "Combined value is: true"
 *       <ProviderComponent />
 *     </FlagProvider>
 *   )
 * }
 * ```
 */
export default function create<I>() {
  const Context = React.createContext<DistributedContext<I> | null>(null)

  function useContext() {
    const ctx = React.useContext(Context)
    invariant(ctx, 'must be used within a Provider')
    return ctx
  }

  function Provider({ children }: React.PropsWithChildren<{}>) {
    const mountedRef = React.useRef<Record<string, I>>({})
    const [counter, setCounter] = React.useState(0)

    const provide = React.useCallback(
      (value: I) => {
        const id = uuid.v4()
        mountedRef.current[id] = value
        setCounter((c) => c + 1)
        return () => {
          delete mountedRef.current[id]
          setCounter((c) => c + 1)
        }
      },
      [mountedRef],
    )

    const collect = React.useCallback(
      () => Object.values(mountedRef.current),
      [mountedRef],
    )

    const instance = React.useMemo(
      () => ({ provide, counter, collect }),
      [provide, counter, collect],
    )

    return <Context.Provider value={instance}>{children}</Context.Provider>
  }

  function useCombined<O>(combine: (values: I[]) => O) {
    const { collect, counter } = useContext()
    const [combined, setCombined] = React.useState(() => combine(collect()))

    React.useEffect(() => {
      setCombined(combine(collect()))
    }, [setCombined, combine, collect, counter])

    return combined
  }

  function makeCombinator<O>(combine: (values: I[]) => O) {
    return () => useCombined(combine)
  }

  function useProvide(value: I) {
    const { provide } = useContext()
    React.useEffect(() => provide(value), [provide, value])
  }

  function Provide({ value, children }: React.PropsWithChildren<{ value: I }>) {
    useProvide(value)
    return <>{children}</>
  }

  return {
    Provider,
    useCombined,
    makeCombinator,
    useProvide,
    Provide,
  }
}

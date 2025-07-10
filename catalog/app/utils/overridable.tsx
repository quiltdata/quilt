import invariant from 'invariant'
import * as React from 'react'
import * as uuid from 'uuid'

interface Overridable<T> {
  push: (value: T) => () => void
  counter: number
  getValues: () => T[]
}

/*
 * Create a context that allows you to push values and combine them using a provided function.
 * It is useful for creating components that can be overridden by other components,
 * such as boolean flags or configuration options.
 * For example, you can use it to create a boolean flag that can be overridden by child components.
 *
 * **Example**:
 *
 * ```
 * // This will create a context that allows you to push boolean values,
 * // and the combined value will be true if at least one of the pushed values is true.
 * const ExampleBoolOverridable = makeOverridable((value: boolean[]) => values.includes(true))
 *
 * function ValueComponent() {
 *   const value = ExampleBoolOverridable.useCombinedValue()
 *   return <div>{`Combined value is: ${value}`}</div>
 * }
 *
 * function ChildComponent() {
 *   ExampleBoolOverridable.usePushValue(true)
 *   return <>sup</>
 * }
 *
 * function Main() {
 *   return (
 *     <ExampleBoolOverridable.Provider>
 *       <ValueComponent /> // This will display "Combined value is: true"
 *       <ChildComponent />
 *     </ExampleBoolOverridable.Provider>
 *   )
 * }
 * ```
 */
export function makeOverridable<T, O>(combineValues: (values: T[]) => O) {
  const Ctx = React.createContext<Overridable<T> | null>(null)

  function Provider({ children }: React.PropsWithChildren<{}>) {
    const mountedRef = React.useRef<Record<string, T>>({})
    const [counter, setCounter] = React.useState(0)

    const push = React.useCallback(
      (value: T) => {
        const id = uuid.v4()
        mountedRef.current[id] = value
        setCounter((c) => c + 1)
        return () => {
          delete mountedRef.current[id]
        }
      },
      [mountedRef],
    )

    const getValues = React.useCallback(
      () => Object.values(mountedRef.current),
      [mountedRef],
    )

    const value = { push, counter, getValues }

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
  }

  function useCombinedValue(): O {
    const ctx = React.useContext(Ctx)
    invariant(ctx, 'must be used within a Provider')

    const { getValues, counter } = ctx
    const [combined, setCombined] = React.useState(() => combineValues(getValues()))

    React.useEffect(() => {
      setCombined(combineValues(getValues()))
    }, [setCombined, getValues, counter])

    return combined
  }

  function usePushValue(value: T) {
    const ctx = React.useContext(Ctx)
    invariant(ctx, 'must be used within a Provider')
    const { push } = ctx
    React.useEffect(() => push(value), [push, value])
  }

  function WithValue({ value, children }: React.PropsWithChildren<{ value: T }>) {
    usePushValue(value)
    return children
  }

  return {
    Provider,
    useCombinedValue,
    usePushValue,
    WithValue,
  }
}

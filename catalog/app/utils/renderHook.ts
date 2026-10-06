import {
  act,
  cleanup,
  renderHook as rtlRenderHook,
  waitFor as rtlWaitFor,
  type RenderHookOptions,
} from '@testing-library/react'

export { act, cleanup }

interface WaitOptions {
  timeout?: number
}

// Like react-hooks' waitFor: a callback returning `false` keeps waiting
// (RTL's only retries on throw).
export function waitFor<T>(callback: () => T, opts?: WaitOptions) {
  return rtlWaitFor(() => {
    const res = callback()
    if (res === false) throw new Error('Condition not met')
    return res
  }, opts)
}

// ponytail: @testing-library/react-hooks' waitForNextUpdate /
// waitForValueToChange over RTL's renderHook; drop as specs move to `waitFor`.
export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options?: RenderHookOptions<Props>,
) {
  const rendered = rtlRenderHook(callback, options)
  // react-hooks' rerender() with no argument reused the last props
  let lastProps = options?.initialProps
  const rerender = (props: Props | undefined = lastProps) => {
    lastProps = props
    rendered.rerender(props)
  }
  const waitForValueToChange = async (selector: () => unknown, opts?: WaitOptions) => {
    const initial = selector()
    await waitFor(() => {
      if (selector() === initial) throw new Error('Value did not change')
    }, opts)
  }
  const waitForNextUpdate = (opts?: WaitOptions) =>
    waitForValueToChange(() => rendered.result.current, opts)
  return { ...rendered, rerender, waitFor, waitForNextUpdate, waitForValueToChange }
}

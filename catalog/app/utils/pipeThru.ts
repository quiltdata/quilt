import * as R from 'ramda'

// Value-first pipe: `pipeThru(value)(fn1, fn2, …)` threads `value` through the
// composed chain `R.pipe(fn1, fn2, …)`. The chain is dynamic, so the result is
// typed as `any` (matching the legacy untyped behavior); prefer fp-ts `pipe`.
/** @deprecated Use pipe from fp-ts */
export default <V>(value: V) =>
  (...fns: Array<(x: any) => any>): any =>
    (R.pipe as any)(...fns)(value)

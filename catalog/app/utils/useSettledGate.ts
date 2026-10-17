import * as Eff from 'effect'
import * as React from 'react'

import defer from 'utils/defer'
import useConst from 'utils/useConstant'

/**
 * An effect that waits until `settled` is first true, then completes at once
 * on every later run. It never closes again.
 */
export default function useSettledGate(settled: boolean): Eff.Effect.Effect<void> {
  const gate = useConst(() => ({ ...defer<void>(), open: false }))
  React.useEffect(() => {
    if (settled && !gate.open) {
      gate.open = true
      gate.resolver.resolve()
    }
  }, [settled, gate])
  return React.useMemo(
    () =>
      Eff.Effect.suspend(() =>
        gate.open ? Eff.Effect.void : Eff.Effect.promise(() => gate.promise),
      ),
    [gate],
  )
}

import * as React from 'react'

import requireAuth from 'containers/Auth/wrapper'

export default function useProtectedDialog<T = {}>(
  open: boolean,
  Comp: React.ComponentType<T>,
) {
  return React.useMemo(() => (open ? requireAuth<T>()(Comp) : Comp), [open, Comp])
}

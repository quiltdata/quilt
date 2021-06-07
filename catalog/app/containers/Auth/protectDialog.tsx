import * as React from 'react'

import requireAuth from 'containers/Auth/wrapper'

export default function useProtectedDialog(open: boolean, Comp: React.ComponentClass) {
  return React.useMemo(() => (open ? requireAuth()(Comp) : Comp), [open, Comp])
}

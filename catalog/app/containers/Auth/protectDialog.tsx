import * as React from 'react'

import requireAuth from 'containers/Auth/wrapper'

export default function useProtectedDialog<
  T extends React.FC<React.PropsWithChildren<{}>> = React.FC
>(open: boolean, Comp: T) {
  return React.useMemo(() => (open ? requireAuth()(Comp) : Comp), [open, Comp])
}

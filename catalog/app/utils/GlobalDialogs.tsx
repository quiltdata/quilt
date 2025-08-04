import invariant from 'invariant'
import * as React from 'react'

import * as Dialogs from 'utils/Dialogs'

export type { Open, Close, ExtraDialogProps } from 'utils/Dialogs'

const Ctx = React.createContext<Dialogs.Open | null>(null)

export function useOpenDialog() {
  const open = React.useContext(Ctx)
  invariant(open, 'useOpenDialog() must be used within <WithGlobalDialogs>')
  return open
}

export { useOpenDialog as use }

export default function WithGlobalDialogs({
  children,
  ...props
}: React.PropsWithChildren<Dialogs.ExtraDialogProps>) {
  const dialogs = Dialogs.use()
  return (
    <Ctx.Provider value={dialogs.open}>
      {children}
      {dialogs.render(props)}
    </Ctx.Provider>
  )
}

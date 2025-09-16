import invariant from 'invariant'
import * as React from 'react'

interface PackageSrc {
  name: string
  hash?: string
}

interface PackageDialogState {
  src?: PackageSrc
  setSrc: (src: PackageSrc) => void
  nameWarning: React.ReactNode
  setNameWarning: (warning: React.ReactNode) => void
}

const Context = React.createContext<PackageDialogState | null>(null)

function useContext(): PackageDialogState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}

export const use = useContext

interface PackageDialogProviderProps {
  children: React.ReactNode
  initialSrc?: PackageSrc
}

export function PackageDialogProvider({
  children,
  initialSrc,
}: PackageDialogProviderProps) {
  const [src, setSrc] = React.useState(initialSrc)
  const [nameWarning, setNameWarning] = React.useState<React.ReactNode>('')

  // Sync with external source updates
  React.useEffect(() => {
    setSrc(initialSrc)
  }, [initialSrc])

  const state = React.useMemo(
    (): PackageDialogState => ({
      src,
      setSrc,
      nameWarning,
      setNameWarning,
    }),
    [src, nameWarning],
  )

  return <Context.Provider value={state}>{children}</Context.Provider>
}

export { PackageDialogProvider as Provider }

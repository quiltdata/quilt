import invariant from 'invariant'
import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import PACKAGE_EXISTS_QUERY from './gql/PackageExists.generated'

type NameStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'exists'; dst: PackageDst }
  | { _tag: 'invalid' }
  | { _tag: 'new' }

interface PackageSrc {
  bucket: string
  name: string
  hash?: string
}

interface PackageDst {
  bucket: string
  name?: string
}

interface PackageDialogState {
  src?: PackageSrc
  setSrc: (src: PackageSrc) => void
  nameStatus: NameStatus
  onName: (name: string) => void
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
  src?: PackageSrc
  dst: PackageDst
}

export function PackageDialogProvider({
  children,
  dst: initialDst,
  src: initialSrc,
}: PackageDialogProviderProps) {
  const [src, setSrc] = React.useState(initialSrc)
  const [dst, setDst] = React.useState(initialDst)

  const packageExistsQuery = GQL.useQuery(
    PACKAGE_EXISTS_QUERY,
    {
      bucket: dst.bucket,
      name: dst.name || '',
    },
    {
      pause: !dst.bucket || !dst.name,
    },
  )
  const nameStatus: NameStatus = React.useMemo(
    () =>
      GQL.fold(packageExistsQuery, {
        data: ({ package: r }) => {
          if (!r) return { _tag: 'new' }
          switch (r.__typename) {
            default: {
              return { _tag: 'exists', dst }
            }
          }
        },
        fetching: () => ({ _tag: 'loading' }),
        error: () => ({ _tag: 'invalid' }),
      }),
    [dst, packageExistsQuery],
  )

  // Sync with external source updates
  React.useEffect(() => {
    setSrc(initialSrc)
  }, [initialSrc])

  const onName = React.useCallback((name: string) => setDst((d) => ({ ...d, name })), [])

  const state = React.useMemo(
    (): PackageDialogState => ({
      src,
      setSrc,
      nameStatus,
      onName,
    }),
    [src, nameStatus, onName],
  )

  return <Context.Provider value={state}>{children}</Context.Provider>
}

export { PackageDialogProvider as Provider }

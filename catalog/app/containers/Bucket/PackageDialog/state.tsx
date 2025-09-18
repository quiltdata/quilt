import invariant from 'invariant'
import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import PACKAGE_EXISTS_QUERY from './gql/PackageExists.generated'

// FIXME: re-use already added files when reload manifest
// FIXME: handle both validations on file input
// FIXME: use workflow' package name template to fill `initialDst`

type NameStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'exists' }
  | { _tag: 'able-to-reuse'; dst: Required<PackageDst> }
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
  name: {
    onChange: (name: string) => void
    status: NameStatus
    value: string | undefined
  }
  src?: PackageSrc
  setSrc: (src: PackageSrc) => void
  reset: () => void
}

const Context = React.createContext<PackageDialogState | null>(null)

export function useContext(): PackageDialogState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within PackageDialogProvider')
  return context
}

export const use = useContext

function useNameValidator(dst: PackageDst, src?: PackageSrc): NameStatus {
  const packageExistsQuery = GQL.useQuery(
    PACKAGE_EXISTS_QUERY,
    {
      bucket: dst.bucket,
      name: dst.name || '',
    },
    {
      pause:
        !dst.bucket || !dst.name || (dst.bucket === src?.bucket && dst.name === src.name),
    },
  )
  return React.useMemo(() => {
    if (dst.bucket === src?.bucket && dst.name === src.name) return { _tag: 'exists' }
    return GQL.fold(packageExistsQuery, {
      data: ({ package: r }) => {
        if (!r) return { _tag: 'new' }
        switch (r.__typename) {
          default:
            return { _tag: 'able-to-reuse', dst: { bucket: dst.bucket, name: r.name } }
        }
      },
      fetching: () => ({ _tag: 'loading' }),
      error: () => ({ _tag: 'invalid' }),
    })
  }, [dst, packageExistsQuery, src])
}

function useName(onChange: (n: string) => void, dst: PackageDst, src?: PackageSrc) {
  const status = useNameValidator(dst, src)
  return React.useMemo(
    () => ({
      onChange,
      status,
      value: dst.name,
    }),
    [dst.name, status, onChange],
  )
}

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

  const reset = React.useCallback(() => {
    setSrc(initialSrc)
    setDst(initialDst)
  }, [initialSrc, initialDst])

  // Sync with external source updates
  React.useEffect(() => reset(), [reset])

  const onName = React.useCallback((name: string) => setDst((d) => ({ ...d, name })), [])
  const name = useName(onName, dst, src)

  return (
    <Context.Provider value={{ reset, src, setSrc, name }}>{children}</Context.Provider>
  )
}

export { PackageDialogProvider as Provider }

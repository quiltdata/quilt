import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as workflows from 'utils/workflows'

import {
  PackageCreationDialogUIOptions,
  PackageCreationDialog,
} from '../PackageDialog/PackageCreationForm'

export function CreatePackageLink(props: Omit<RRDom.LinkProps, 'to'>) {
  const location = RRDom.useLocation()
  const search = React.useMemo(() => {
    const searchParams = new URLSearchParams(location.search)
    searchParams.set('createPackage', 'true')
    return searchParams.toString()
  }, [location.search])
  return <RRDom.Link {...props} to={(loc) => ({ ...loc, search: `?${search}` })} />
}

const Ctx = React.createContext<{
  open: () => void
  setDst: (s: workflows.Successor) => void
} | null>(null)

interface ProviderProps {
  // Use it if you need to add CreatePackage dialog for specific places
  // ex. ?createPackage=bookmarks
  // and ignore global ?cretePackage=true
  id?: 'bookmarks'
  bucket: string
  name?: string
  hashOrTag?: string
  s3Path?: string
  ui: PackageCreationDialogUIOptions
  delayHashing?: boolean
  disableStateDisplay?: boolean
  children: React.ReactNode
}

export function Provider({
  id,
  bucket,
  name,
  hashOrTag,
  s3Path,
  ui,
  delayHashing,
  disableStateDisplay,
  children,
}: ProviderProps) {
  const history = RRDom.useHistory()
  const location = RRDom.useLocation()
  const searchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )
  const open = React.useCallback(() => {
    searchParams.set('createPackage', id || 'true')
    history.push({
      search: searchParams.toString(),
    })
  }, [id, history, searchParams])
  const [successor, setSuccessor] = React.useState({
    slug: bucket,
  } as workflows.Successor)
  const packageHandle = React.useMemo(() => {
    if (!name || !hashOrTag) return undefined
    return { name, hashOrTag }
  }, [name, hashOrTag])
  const value = React.useMemo(
    () => ({
      open,
      setDst: setSuccessor,
    }),
    [open],
  )
  return (
    <Ctx.Provider value={value}>
      <PackageCreationDialog
        ui={ui}
        id={id}
        src={{ bucket, packageHandle, s3Path }}
        successor={successor}
        onSuccessor={setSuccessor}
        delayHashing={delayHashing}
        disableStateDisplay={disableStateDisplay}
      />
      {children}
    </Ctx.Provider>
  )
}

export const useCreatePackage = () => React.useContext(Ctx)

export const use = useCreatePackage

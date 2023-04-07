// import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

// import usePrevious from 'utils/usePrevious'
import * as workflows from 'utils/workflows'

import {
  PackageCreationDialogUIOptions,
  usePackageCreationDialog,
} from '../PackageDialog'

export * from './PackageCreationForm'

export function Link(props: Omit<RRDom.LinkProps, 'to'>) {
  // FIXME: don't erase other search params
  return (
    <RRDom.Link {...props} to={(loc) => ({ ...loc, search: '?createPackage=list' })} />
  )
}

const Ctx = React.createContext<{
  open: () => void
  setDst: (s: workflows.Successor) => void
} | null>(null)

interface ProviderProps {
  // make bookmarks a special case only, and make id optional
  id: 'athena' | 'package' | 'list' | 'bookmarks' | 'dir' | 'revision'
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
  children,
}: ProviderProps) {
  const history = RRDom.useHistory()
  const location = RRDom.useLocation()
  const searchParams = React.useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )
  const open = React.useCallback(() => {
    searchParams.set('createPackage', id)
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
  const packageDialog = usePackageCreationDialog({
    id,
    src: { bucket, packageHandle, s3Path },
    successor,
    onSuccessor: setSuccessor,
  })
  /*
  usePrevious({ bucket, name, hashOrTag }, (prev) => {
    // close the dialog when navigating away
    // TODO: consider to remove it, because when navigating away
    //       there is a high chance to change URL
    if (!R.equals({ bucket, name, hashOrTag }, prev)) packageDialog.close()
  })
  */
  const value = React.useMemo(
    () => ({
      open,
      setDst: setSuccessor,
    }),
    [open],
  )
  return (
    <Ctx.Provider value={value}>
      {packageDialog.render(ui)}
      {children}
    </Ctx.Provider>
  )
}

export const useCreatePackage = () => React.useContext(Ctx)

export const use = useCreatePackage

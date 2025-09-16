import invariant from 'invariant'
import * as React from 'react'

import * as FileEditor from 'components/FileEditor'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import * as Dialogs from 'utils/Dialogs'

import UploadDialog from './UploadDialog'

interface AddState {
  createFile: () => void
  openUploadDialog: () => void
}

const Context = React.createContext<AddState | null>(null)

function useContext(): AddState {
  const context = React.useContext(Context)
  invariant(context, 'useContext must be used within AddDirProvider')
  return context
}

export const use = useContext

interface AddProviderProps {
  children: React.ReactNode
  handle: Toolbar.DirHandle
}

export function AddProvider({ children, handle }: AddProviderProps) {
  const dialogs = Dialogs.use()
  const prompt = FileEditor.useCreateFileInBucket(handle.bucket, handle.path)

  const createFile = React.useCallback(() => {
    prompt.open()
  }, [prompt])

  const openUploadDialog = React.useCallback(() => {
    dialogs.open(({ close }) => <UploadDialog handle={handle} onClose={close} />)
  }, [dialogs, handle])

  const actions = React.useMemo(
    (): AddState => ({
      createFile,
      openUploadDialog,
    }),
    [createFile, openUploadDialog],
  )

  return (
    <Context.Provider value={actions}>
      {children}

      {prompt.render()}

      {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
    </Context.Provider>
  )
}

export { AddProvider as Provider }

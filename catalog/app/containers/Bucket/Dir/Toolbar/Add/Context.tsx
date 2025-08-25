import invariant from 'invariant'
import * as React from 'react'

import * as FileEditor from 'components/FileEditor'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import * as Dialogs from 'utils/Dialogs'

import UploadDialog from './UploadDialog'

interface AddDirActions {
  createFile: () => void
  openUploadDialog: () => void
}

const AddDirContext = React.createContext<AddDirActions | null>(null)

function useContext(): AddDirActions {
  const context = React.useContext(AddDirContext)
  invariant(context, 'useAddDirActions must be used within AddDirProvider')
  return context
}

export const use = useContext

interface AddDirProviderProps {
  children: React.ReactNode
  handle: Toolbar.DirHandle
}

export function AddDirProvider({ children, handle }: AddDirProviderProps) {
  const dialogs = Dialogs.use()
  const prompt = FileEditor.useCreateFileInBucket(handle.bucket, handle.path)

  const createFile = React.useCallback(() => {
    prompt.open()
  }, [prompt])

  const openUploadDialog = React.useCallback(() => {
    dialogs.open(({ close }) => <UploadDialog handle={handle} onClose={close} />)
  }, [dialogs, handle])

  const actions = React.useMemo(
    (): AddDirActions => ({
      createFile,
      openUploadDialog,
    }),
    [createFile, openUploadDialog],
  )

  return (
    <AddDirContext.Provider value={actions}>
      {children}

      {prompt.render()}

      {dialogs.render({ fullWidth: true, maxWidth: 'sm' })}
    </AddDirContext.Provider>
  )
}

export { AddDirProvider as Provider }

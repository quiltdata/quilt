import * as React from 'react'

import * as Buttons from 'components/Buttons'
import cfg from 'constants/config'
import mkStorage from 'utils/storage'

import * as FileView from './FileView'
import * as Selection from './Selection'

interface DownloadButtonProps {
  className: string
  label: string
  path?: string
  selection: Selection.ListingSelection
}

export function DownloadButton({
  className,
  selection,
  label,
  path,
}: DownloadButtonProps) {
  if (cfg.noDownload) return null

  return (
    <FileView.ZipDownloadForm
      suffix={path}
      files={Selection.toHandlesList(selection).map(({ key }) => key)}
    >
      <Buttons.Iconized
        className={className}
        label={label}
        icon="archive"
        type="submit"
      />
    </FileView.ZipDownloadForm>
  )
}

const STORAGE_KEYS = {
  LOCAL_FOLDER: 'LOCAL_FOLDER',
}
const storage = mkStorage({
  [STORAGE_KEYS.LOCAL_FOLDER]: STORAGE_KEYS.LOCAL_FOLDER,
})

export function useLocalFolder(): [string, (v: string) => void] {
  const [value, setValue] = React.useState(() => {
    try {
      return storage.get(STORAGE_KEYS.LOCAL_FOLDER) || ''
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return ''
    }
  })
  const onChange = React.useCallback(
    (path) => {
      storage.set(STORAGE_KEYS.LOCAL_FOLDER, path)
      setValue(path)
    },
    [setValue],
  )
  return React.useMemo(() => [value, onChange], [value, onChange])
}

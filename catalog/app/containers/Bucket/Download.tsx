import * as React from 'react'

import cfg from 'constants/config'
import mkStorage from 'utils/storage'

import ButtonIconized from 'components/ButtonIconized'

import * as FileView from './FileView'

interface DownloadButtonProps {
  className: string
  label: string
  onClick: () => void
  path?: string
}

export function DownloadButton({ className, label, onClick, path }: DownloadButtonProps) {
  if (cfg.noDownload) return null

  if (cfg.desktop) {
    return (
      <ButtonIconized
        className={className}
        label={label}
        icon="archive"
        type="submit"
        onClick={onClick}
      />
    )
  }

  return <FileView.ZipDownloadForm className={className} label={label} suffix={path} />
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

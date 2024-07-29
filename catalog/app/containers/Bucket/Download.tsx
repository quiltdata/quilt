import * as React from 'react'

import * as Buttons from 'components/Buttons'
import cfg from 'constants/config'
import * as SP from 'utils/SharePoint'
import StyledTooltip from 'utils/StyledTooltip'
import mkStorage from 'utils/storage'

import * as FileView from './FileView'

interface DownloadButtonProps {
  className: string
  label: string
  onClick: () => void
  path?: string
}

export function DownloadButton({ className, label, onClick, path }: DownloadButtonProps) {
  const { authToken, retry } = SP.useSharePoint()
  if (cfg.noDownload) return null

  if (cfg.desktop) {
    return (
      <Buttons.Iconized
        className={className}
        label={label}
        icon="archive"
        type="submit"
        onClick={onClick}
      />
    )
  }
  if (!authToken) {
    return (
      <StyledTooltip title="Unable to get SharePoint credentials. Click to obtain">
        <Buttons.Iconized
          className={className}
          label={label}
          icon="replay"
          onClick={retry}
        />
      </StyledTooltip>
    )
  }

  return (
    <FileView.ZipDownloadForm suffix={path} spAccessToken={authToken.accessToken}>
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

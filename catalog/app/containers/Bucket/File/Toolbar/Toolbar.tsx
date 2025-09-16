import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import type { EditorState } from 'components/FileEditor'
import * as Toolbar from 'containers/Bucket/Toolbar'
import type { ViewModes } from 'containers/Bucket/viewModes'
import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'
import ToolbarErrorBoundary from 'containers/Bucket/Toolbar/ErrorBoundary'

import * as Get from './Get'
import * as Organize from './Organize'

export { FileHandleCreate as CreateHandle } from 'containers/Bucket/Toolbar'
export { Get, Organize }

interface Features {
  get: false | { code: boolean } | null
  organize: boolean | null
  qurator: boolean | null
}

export function useFeatures(notAvailable?: boolean): Features | null {
  const { prefs } = BucketPreferences.use()
  if (typeof notAvailable === 'undefined') return null
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions, blocks } }) => ({
        get:
          !notAvailable && !cfg.noDownload && actions.downloadObject
            ? { code: blocks.code }
            : false,
        organize: !notAvailable,
        qurator: blocks.qurator,
      }),
      _: () => null,
    },
    prefs,
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
  },
  qurator: {
    marginLeft: t.spacing(-1),
  },
}))

interface FileToolbarProps {
  children?: React.ReactNode
  className?: string
  deleted?: boolean
  editorState?: EditorState
  features: Features | null
  handle: Toolbar.FileHandle
  onReload: () => void
  viewModes: ViewModes
}

export function FileToolbar({
  children,
  className,
  editorState,
  features,
  handle,
  onReload,
  viewModes,
}: FileToolbarProps) {
  const classes = useStyles()

  if (!features) {
    return (
      <div className={cx(classes.root, className)}>
        <Lab.Skeleton variant="rect">
          <M.Button size="small" variant="outlined">
            Loading...
          </M.Button>
        </Lab.Skeleton>
        <Lab.Skeleton variant="circle">
          <M.IconButton size="small">
            <M.Icon />
          </M.IconButton>
        </Lab.Skeleton>
      </div>
    )
  }

  return (
    <div className={cx(classes.root, className)}>
      <ToolbarErrorBoundary>
        {children}

        {features.get && (
          <Toolbar.Get label="Get file">
            <Get.Options handle={handle} hideCode={!features.get.code} />
          </Toolbar.Get>
        )}

        {features.organize && !!editorState && (
          <Organize.Context.Provider
            editorState={editorState}
            handle={handle}
            onReload={onReload}
          >
            <Toolbar.Organize>
              <Organize.Options viewModes={viewModes} />
            </Toolbar.Organize>
          </Organize.Context.Provider>
        )}

        {features.qurator && <Toolbar.Assist className={classes.qurator} />}
      </ToolbarErrorBoundary>
    </div>
  )
}

export { FileToolbar as Toolbar }

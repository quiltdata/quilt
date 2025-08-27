import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

import * as Toolbar from 'containers/Bucket/Toolbar'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog'
import * as Selection from 'containers/Bucket/Selection'
import ToolbarErrorBoundary from 'containers/Bucket/Toolbar/ErrorBoundary'

import * as Add from './Add'
import * as CreatePackage from './CreatePackage'
import * as Get from './Get'
import * as Organize from './Organize'

export { DirHandleCreate as CreateHandle } from 'containers/Bucket/Toolbar'
export { Add, CreatePackage, Get, Organize }

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: t.spacing(1),
  },
}))

interface Features {
  add: boolean | null
  get: false | { code: boolean } | null
  organize: boolean | null
  createPackage: boolean | null
}

export function useFeatures(): Features | null {
  const { prefs } = BucketPreferences.use()
  return React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions, blocks } }) => ({
            add: actions.writeFile,
            get:
              !cfg.noDownload && actions.downloadObject ? { code: blocks.code } : false,
            organize: true,
            createPackage: actions.createPackage,
          }),
          _: () => null,
        },
        prefs,
      ),
    [prefs],
  )
}

interface DirToolbarProps {
  className?: string
  features: Features | null
  handle: Toolbar.DirHandle
  onReload: () => void
}

function DirToolbar({ className, features, handle, onReload }: DirToolbarProps) {
  const classes = useStyles()
  const slt = Selection.use()

  const { path, bucket } = handle

  const packageDirectoryDialog = usePackageCreationDialog({
    s3Path: path,
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })

  const openPackageCreationDialog = React.useCallback(
    (successor) => {
      packageDirectoryDialog.open({
        path,
        selection: slt.selection,
        successor,
      })
    },
    [packageDirectoryDialog, path, slt.selection],
  )

  const successors = CreatePackage.useSuccessors(bucket)

  if (!features)
    return (
      <div className={cx(classes.root, className)}>
        <Buttons.Skeleton size="small" />
        <Buttons.Skeleton size="small" />
        <Buttons.Skeleton size="small" />
        <Buttons.Skeleton size="small" />
      </div>
    )

  return (
    <div className={cx(classes.root, className)}>
      <ToolbarErrorBoundary>
        {packageDirectoryDialog.render({
          successTitle: 'Package created',
          successRenderMessage: ({ packageLink }) => (
            <>Package {packageLink} successfully created</>
          ),
          title: 'Create package',
        })}

        {features.add && (
          <Add.Context.Provider handle={handle}>
            <Toolbar.Add>
              <Add.Options />
            </Toolbar.Add>
          </Add.Context.Provider>
        )}

        {features.get && (
          <Toolbar.Get>
            <Get.Options handle={handle} hideCode={!features.get.code} />
          </Toolbar.Get>
        )}

        {features.organize && (
          <Organize.Context.Provider onReload={onReload}>
            <Toolbar.Organize onReload={onReload}>
              <Organize.Options />
            </Toolbar.Organize>
          </Organize.Context.Provider>
        )}

        {features.createPackage && (
          <Toolbar.CreatePackage>
            <CreatePackage.Options
              onChange={openPackageCreationDialog}
              successors={successors}
            />
          </Toolbar.CreatePackage>
        )}
      </ToolbarErrorBoundary>
    </div>
  )
}

export { DirToolbar as Toolbar }

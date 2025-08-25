import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

import * as PD from '../PackageDialog'
import * as Selection from '../Selection'

import * as Add from './Add'
import * as CreatePackage from './CreatePackage'
import * as Get from './Get'
import * as Organize from './Organize'
import type { DirHandle } from './types'

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

export function useBucketDirFeatures(): Features | null {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions, blocks } }) => ({
        add: actions.writeFile,
        get: !cfg.noDownload && actions.downloadObject ? { code: blocks.code } : false,
        organize: true,
        createPackage: actions.createPackage,
      }),
      _: () => null,
    },
    prefs,
  )
}

interface BucketDirProps {
  className?: string
  features: Features | null
  handle: DirHandle
  onReload: () => void
}

export function BucketDir({ className, features, handle, onReload }: BucketDirProps) {
  const classes = useStyles()
  const slt = Selection.use()

  const { path, bucket } = handle

  const packageDirectoryDialog = PD.usePackageCreationDialog({
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
      {packageDirectoryDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}

      {features.add && (
        <Add.ContextDir.Provider handle={handle}>
          <Add.Button>
            <Add.BucketDirOptions />
          </Add.Button>
        </Add.ContextDir.Provider>
      )}

      {features.get && (
        <Get.Button>
          <Get.BucketDirOptions handle={handle} hideCode={!features.get.code} />
        </Get.Button>
      )}

      {features.organize && (
        <Organize.ContextDir.Provider onReload={onReload}>
          <Organize.Button onReload={onReload}>
            <Organize.BucketDirOptions />
          </Organize.Button>
        </Organize.ContextDir.Provider>
      )}

      {features.createPackage && (
        <CreatePackage.Button>
          <CreatePackage.BucketDirOptions
            onChange={openPackageCreationDialog}
            successors={successors}
          />
        </CreatePackage.Button>
      )}
    </div>
  )
}

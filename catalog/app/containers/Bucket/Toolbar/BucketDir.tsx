import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

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

function useFeatures(): Features | null {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions, blocks } }) => ({
        add: actions.writeFile,
        get_code: blocks.code,
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
  handle: DirHandle
}

export default function BucketDir({ className, handle }: BucketDirProps) {
  const classes = useStyles()
  const features = useFeatures()

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
      {features.add && (
        <Add.Button>
          <Add.BucketDirOptions handle={handle} />
        </Add.Button>
      )}

      {features.get && (
        <Get.Button>
          <Get.BucketDirOptions handle={handle} hideCode={!features.get.code} />
        </Get.Button>
      )}

      {features.organize && (
        <Organize.Button>
          <Organize.BucketDirOptions handle={handle} />
        </Organize.Button>
      )}

      {features.createPackage && (
        <CreatePackage.Button handle={handle}>
          <CreatePackage.BucketDirOptions handle={handle} />
        </CreatePackage.Button>
      )}
    </div>
  )
}

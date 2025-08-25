import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import type { EditorState } from 'components/FileEditor'
import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

import AssistButton from '../AssistButton'
import type { ViewModes } from '../viewModes'

import * as Get from './Get'
import * as Organize from './Organize'
import type { FileHandle } from './types'

interface Features {
  get: false | { code: boolean } | null
  organize: boolean | null
  qurator: boolean | null
}

export function useBucketFileFeatures(deleted?: boolean): Features | null {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions, blocks } }) => ({
        get:
          !deleted && !cfg.noDownload && actions.downloadObject
            ? { code: blocks.code }
            : false,
        organize: true,
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

interface BucketFileProps {
  children?: React.ReactNode
  className?: string
  deleted?: boolean
  editorState?: EditorState
  features: Features | null
  handle: FileHandle
  onReload: () => void
  viewModes: ViewModes
}

export function BucketFile({
  children,
  className,
  editorState,
  features,
  handle,
  onReload,
  viewModes,
}: BucketFileProps) {
  const classes = useStyles()

  if (!features)
    return (
      <div className={cx(classes.root, className)}>
        <Buttons.Skeleton size="small" />
        <Buttons.Skeleton size="small" />
        <Buttons.Skeleton size="small" />
      </div>
    )

  return (
    <div className={cx(classes.root, className)}>
      {children}

      {features.get && (
        <Get.Button label="Get file">
          <Get.BucketFileOptions handle={handle} hideCode={!features.get.code} />
        </Get.Button>
      )}

      {features.organize && !!editorState && (
        <Organize.ContextFile.Provider
          editorState={editorState}
          handle={handle}
          onReload={onReload}
        >
          <Organize.Button onReload={onReload}>
            <Organize.BucketFileOptions viewModes={viewModes} />
          </Organize.Button>
        </Organize.ContextFile.Provider>
      )}

      {features.qurator && <AssistButton className={classes.qurator} edge="end" />}
    </div>
  )
}

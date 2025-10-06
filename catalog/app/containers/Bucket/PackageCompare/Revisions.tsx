import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import type { PackageHandle } from 'utils/packageHandle'

import useRevisions from './useRevisions'
import RevisionsList from './RevisionsList'

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  revisions: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: t.spacing(1),
  },
  swap: {
    marginLeft: t.spacing(3),
    flexShrink: 0,
  },
}))

interface HeaderProps {
  left: PackageHandle
  right: PackageHandle | null
  onLeftChange: (hash: string) => void
  onRightChange: (hash: string) => void
  onSwap: () => void
}

export default function Revisions({
  left,
  right,
  onLeftChange,
  onRightChange,
  onSwap,
}: HeaderProps) {
  const classes = useHeaderStyles()
  const data = useRevisions(left.bucket, left.name)
  switch (data._tag) {
    case 'loading':
      return (
        <div className={classes.root}>
          <div className={classes.revisions}>
            <Lab.Skeleton width="100%" variant="rect">
              <M.Select fullWidth />
            </Lab.Skeleton>
            <Lab.Skeleton width="100%" variant="rect">
              <M.Select fullWidth />
            </Lab.Skeleton>
          </div>
          <Lab.Skeleton className={classes.swap} variant="circle">
            <M.IconButton />
          </Lab.Skeleton>
        </div>
      )
    case 'error':
      return <Lab.Alert severity="error">{data.error.message}</Lab.Alert>
    case 'ok':
      return (
        <div className={classes.root}>
          <div className={classes.revisions}>
            <RevisionsList
              revisions={data.revisions}
              value={left.hash}
              onChange={onLeftChange}
              temporaryRemoveNone
            />
            <RevisionsList
              revisions={data.revisions}
              value={right?.hash || ''}
              onChange={onRightChange}
            />
          </div>
          <M.IconButton className={classes.swap} onClick={onSwap} disabled={!right}>
            <Icons.SwapVert />
          </M.IconButton>
        </div>
      )
  }
}

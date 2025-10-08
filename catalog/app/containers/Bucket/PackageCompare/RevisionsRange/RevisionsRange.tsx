import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import type { PackageHandle } from 'utils/packageHandle'

import RevisionSelect from './RevisionSelect'
import useRevisions from './useRevisions'
import type { Revision } from './useRevisions'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  range: {
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

function Skeleton() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <div className={classes.range}>
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
}

interface RevisionsProps extends RevisionsHandlerProps {
  revisions: readonly Revision[]
}

function Revisions({
  revisions,
  base,
  other,
  onBaseChange,
  onOtherChange,
  onSwap,
}: RevisionsProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <div className={classes.range}>
        <RevisionSelect
          revisions={revisions}
          value={base.hash}
          onChange={onBaseChange}
          temporaryRemoveNone
        />
        <RevisionSelect
          revisions={revisions}
          value={other?.hash || ''}
          onChange={onOtherChange}
        />
      </div>
      <M.IconButton className={classes.swap} onClick={onSwap} disabled={!other}>
        <Icons.SwapVert />
      </M.IconButton>
    </div>
  )
}

interface RevisionsHandlerProps {
  base: PackageHandle
  other: PackageHandle | null
  onBaseChange: (hash: string) => void
  onOtherChange: (hash: string) => void
  onSwap: () => void
}

export default function RevisionsHandler({ base, ...props }: RevisionsHandlerProps) {
  const data = useRevisions(base.bucket, base.name)
  switch (data._tag) {
    case 'loading':
      return <Skeleton />
    case 'error':
      return <Lab.Alert severity="error">{data.error.message}</Lab.Alert>
    case 'ok':
      return <Revisions base={base} revisions={data.revisions} {...props} />
  }
}

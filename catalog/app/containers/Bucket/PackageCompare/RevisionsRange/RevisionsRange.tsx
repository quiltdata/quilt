import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import type { PackageHandle } from 'utils/packageHandle'

import RevisionSelect from './RevisionSelect'
import useRevisionsList from './useRevisionsList'
import type { RevisionsListItem } from './useRevisionsList'

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
    marginLeft: t.spacing(2),
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

interface RevisionsProps extends Omit<RevisionsHandlerProps, 'bucket' | 'name'> {
  revisions: readonly RevisionsListItem[]
}

function Revisions({
  revisions,
  pair: [base, other],
  onBaseChange,
  onOtherChange,
  onSwap,
}: RevisionsProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <div className={classes.range}>
        <RevisionSelect revisions={revisions} value={base.hash} onChange={onBaseChange} />
        <RevisionSelect
          revisions={revisions}
          value={other?.hash || ''}
          onChange={onOtherChange}
          other
        />
      </div>
      <M.IconButton className={classes.swap} onClick={onSwap} disabled={!other}>
        <Icons.SwapVert />
      </M.IconButton>
    </div>
  )
}

interface RevisionsHandlerProps {
  bucket: string
  name: string
  pair: [PackageHandle] | [PackageHandle, PackageHandle]
  onBaseChange: (hash: string) => void
  onOtherChange: (hash: string) => void
  onSwap: () => void
}

function RevisionsHandler({ bucket, name, ...props }: RevisionsHandlerProps) {
  const data = useRevisionsList(bucket, name)
  switch (data._tag) {
    case 'loading':
      return <Skeleton />
    case 'error':
      return <Lab.Alert severity="error">{data.error.message}</Lab.Alert>
    case 'ok':
      return <Revisions revisions={data.revisions} {...props} />
  }
}

const useRevisionsWrapperStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
  },
  legend: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginBottom: t.spacing(1),
  },
}))

interface RevisionsWrapperProps extends RevisionsHandlerProps {
  className?: string
}

export default function RevisionsWrapper({ className, ...props }: RevisionsWrapperProps) {
  const classes = useRevisionsWrapperStyles()
  return (
    <M.Paper className={cx(classes.root, className)}>
      <p className={classes.legend}>Choose two revisions to see what’s changed</p>
      <RevisionsHandler {...props} />
    </M.Paper>
  )
}

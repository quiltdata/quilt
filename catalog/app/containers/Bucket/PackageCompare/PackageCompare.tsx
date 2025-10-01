import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type { PackageHandle } from 'utils/packageHandle'

import * as FileView from '../FileView'
import WithPackagesSupport from '../WithPackagesSupport'

import RevisionsList from './RevisionsList'
import MetadataDiff from './Diff/Metadata'
import ManifestDiff from './Diff/Manifest'
import SystemMetaTable from './SystemMetaTable'
import { useRevision } from './useRevision'

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridColumnGap: t.spacing(4),
    alignItems: 'flex-start',
  },
}))

interface HeaderProps {
  left: PackageHandle
  right: PackageHandle | null
  onLeftChange: (hash: string) => void
  onRightChange: (hash: string) => void
}

function Header({ left, right, onLeftChange, onRightChange }: HeaderProps) {
  const classes = useHeaderStyles()
  const packageHandle = React.useMemo(() => left, [left])
  return (
    <div className={classes.root}>
      <RevisionsList
        packageHandle={packageHandle}
        value={left.hash}
        onChange={onLeftChange}
        temporaryRemoveNone
      />
      <RevisionsList
        packageHandle={packageHandle}
        value={right?.hash || ''}
        onChange={onRightChange}
      />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {},
  systemMeta: {
    padding: t.spacing(2),
  },
  table: {
    marginTop: t.spacing(1),
  },
  userMeta: {
    marginTop: t.spacing(4),
  },
  entries: {
    marginTop: t.spacing(4),
  },
}))

interface RevisionsCompareProps {
  left: PackageHandle
  right: PackageHandle | null
  onLeftChange: (hash: string) => void
  onRightChange: (hash: string) => void
}

export function RevisionsCompare({
  left,
  right,
  onLeftChange,
  onRightChange,
}: RevisionsCompareProps) {
  const classes = useStyles()

  const leftRevisionResult = useRevision(left.bucket, left.name, left.hash)
  const rightRevisionResult = useRevision(left.bucket, left.name, right?.hash || null)

  return (
    <div className={classes.root}>
      <M.Paper className={classes.systemMeta}>
        <Header
          left={left}
          right={right}
          onLeftChange={onLeftChange}
          onRightChange={onRightChange}
        />

        <SystemMetaTable
          left={left}
          right={right}
          leftRevision={leftRevisionResult}
          rightRevision={rightRevisionResult}
        />
      </M.Paper>

      <div className={classes.userMeta}>
        <M.Typography variant="subtitle1" gutterBottom>
          User metadata
        </M.Typography>
        <M.Paper square variant="outlined">
          <MetadataDiff left={leftRevisionResult} right={rightRevisionResult} />
        </M.Paper>
      </div>

      <div className={classes.entries}>
        <M.Typography variant="subtitle1" gutterBottom>
          Entries
        </M.Typography>
        <M.Paper square variant="outlined">
          <ManifestDiff left={leftRevisionResult} right={rightRevisionResult} />
        </M.Paper>
      </div>
    </div>
  )
}

export default function PackageCompareWrapper() {
  const { bucket, name, revisionLeft, revisionRight } = RRDom.useParams<{
    bucket: string
    name: string
    revisionLeft: string
    revisionRight: string
  }>()

  invariant(!!bucket, '`bucket` must be defined')
  invariant(!!name, '`name` must be defined')
  invariant(!!revisionLeft, '`revisionLeft` must be defined')

  const { push } = RRDom.useHistory()
  const { urls } = NamedRoutes.use()

  const left = React.useMemo(
    () => ({ bucket, name, hash: revisionLeft }),
    [bucket, name, revisionLeft],
  )

  const right = React.useMemo(
    () => (revisionRight ? { bucket, name, hash: revisionRight } : null),
    [bucket, name, revisionRight],
  )

  const handleLeftChange = React.useCallback(
    (hash: string) => push(urls.bucketPackageCompare(bucket, name, hash, revisionRight)),
    [bucket, name, push, revisionRight, urls],
  )
  const handleRightChange = React.useCallback(
    (hash: string) => push(urls.bucketPackageCompare(bucket, name, revisionLeft, hash)),
    [bucket, name, push, revisionLeft, urls],
  )

  return (
    <>
      <MetaTitle>{[`${name} comparison`, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <FileView.Root>
          <M.Typography variant="body1" gutterBottom>
            <StyledLink to={urls.bucketPackageDetail(left.bucket, left.name)}>
              {left.name}
            </StyledLink>
          </M.Typography>
          <RevisionsCompare
            left={left}
            right={right}
            onLeftChange={handleLeftChange}
            onRightChange={handleRightChange}
          />
        </FileView.Root>
      </WithPackagesSupport>
    </>
  )
}

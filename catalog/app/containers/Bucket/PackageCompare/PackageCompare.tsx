import cx from 'classnames'
import * as dateFns from 'date-fns'
import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { readableBytes } from 'utils/string'
import type { PackageHandle } from 'utils/packageHandle'

import * as FileView from '../FileView'
import WithPackagesSupport from '../WithPackagesSupport'

import RevisionsList from './RevisionsList'
import MetadataDiff from './Diff/Metadata'
import ManifestDiff from './Diff/Manifest'
import { Revision, useRevision } from './useRevision'

interface ModifiedProps {
  packageHandle: PackageHandle
  revision: Revision
}

function Modified({
  packageHandle: { bucket, name },
  revision: { modified, hash },
}: ModifiedProps) {
  const { urls } = NamedRoutes.use()
  const formatted = React.useMemo(
    () => dateFns.format(modified, 'MMMM do yyyy - h:mma'),
    [modified],
  )
  return (
    <M.Typography variant="body2">
      <StyledLink to={urls.bucketPackageTree(bucket, name, hash)}>{formatted}</StyledLink>
    </M.Typography>
  )
}

function ModifiedSkeleton() {
  return (
    <M.Typography variant="body2">
      <Lab.Skeleton width={120} />
    </M.Typography>
  )
}

const useMessageStyles = M.makeStyles((t) => ({
  empty: {
    color: t.palette.text.secondary,
    fontStyle: 'italic',
  },
}))

interface MessageProps {
  revision: Revision
}

function Message({ revision: { message } }: MessageProps) {
  const classes = useMessageStyles()
  return (
    <M.Typography className={cx(!message && classes.empty)} variant="body2">
      {message || 'No message'}
    </M.Typography>
  )
}

function MessageSkeleton() {
  return (
    <M.Typography variant="body2">
      <Lab.Skeleton width={240} />
    </M.Typography>
  )
}

interface SizeProps {
  revision: Revision
}

function Size({ revision: { totalBytes } }: SizeProps) {
  return <M.Typography variant="body2">{readableBytes(totalBytes)}</M.Typography>
}

function SizeSkeleton() {
  return (
    <M.Typography variant="body2">
      <Lab.Skeleton width={60} />
    </M.Typography>
  )
}

const useHeaderStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridColumnGap: t.spacing(4),
  },
}))

interface HeaderProps {
  left: PackageHandle
  right: PackageHandle
  onLeftChange: (hash: string) => void
  onRightChange: (hash: string) => void
}

function Header({ left, right, onLeftChange, onRightChange }: HeaderProps) {
  const classes = useHeaderStyles()
  return (
    <div className={classes.root}>
      <RevisionsList packageHandle={left} onChange={onLeftChange} label="Left Revision" />
      <RevisionsList
        packageHandle={right}
        onChange={onRightChange}
        label="Right Revision"
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
  right: PackageHandle
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
  const rightRevisionResult = useRevision(right.bucket, right.name, right.hash)

  // Return null if either revision is idle
  if (leftRevisionResult._tag === 'idle' || rightRevisionResult._tag === 'idle') {
    return null
  }

  if (leftRevisionResult._tag === 'error') {
    return <Lab.Alert severity="error">{leftRevisionResult.error.message}</Lab.Alert>
  }

  if (rightRevisionResult._tag === 'error') {
    return <Lab.Alert severity="error">{rightRevisionResult.error.message}</Lab.Alert>
  }

  return (
    <div className={classes.root}>
      <M.Paper className={classes.systemMeta}>
        <Header
          left={left}
          right={right}
          onLeftChange={onLeftChange}
          onRightChange={onRightChange}
        />

        <M.Table className={classes.table}>
          <M.TableBody>
            <M.TableRow>
              <M.TableCell>
                {leftRevisionResult._tag === 'loading' ? (
                  <ModifiedSkeleton />
                ) : (
                  <Modified packageHandle={left} revision={leftRevisionResult.revision} />
                )}
              </M.TableCell>
              <M.TableCell>
                {rightRevisionResult._tag === 'loading' ? (
                  <ModifiedSkeleton />
                ) : (
                  <Modified
                    packageHandle={right}
                    revision={rightRevisionResult.revision}
                  />
                )}
              </M.TableCell>
            </M.TableRow>
            <M.TableRow>
              <M.TableCell>
                {leftRevisionResult._tag === 'loading' ? (
                  <MessageSkeleton />
                ) : (
                  <Message revision={leftRevisionResult.revision} />
                )}
              </M.TableCell>
              <M.TableCell>
                {rightRevisionResult._tag === 'loading' ? (
                  <MessageSkeleton />
                ) : (
                  <Message revision={rightRevisionResult.revision} />
                )}
              </M.TableCell>
            </M.TableRow>
            <M.TableRow>
              <M.TableCell>
                {leftRevisionResult._tag === 'loading' ? (
                  <SizeSkeleton />
                ) : (
                  <Size revision={leftRevisionResult.revision} />
                )}
              </M.TableCell>
              <M.TableCell>
                {rightRevisionResult._tag === 'loading' ? (
                  <SizeSkeleton />
                ) : (
                  <Size revision={rightRevisionResult.revision} />
                )}
              </M.TableCell>
            </M.TableRow>
          </M.TableBody>
        </M.Table>
      </M.Paper>

      <div className={classes.userMeta}>
        <M.Typography variant="h6" gutterBottom>
          Metadata Comparison
        </M.Typography>
        <M.Paper>
          <MetadataDiff left={leftRevisionResult} right={rightRevisionResult} />
        </M.Paper>
      </div>

      <div className={classes.entries}>
        <M.Typography variant="h6" gutterBottom>
          Entries Comparison
        </M.Typography>
        <M.Paper>
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
  invariant(!!revisionRight, '`revisionRight` must be defined')

  const { push } = RRDom.useHistory()
  const { urls } = NamedRoutes.use()

  const left: PackageHandle = React.useMemo(
    () => ({ bucket, name, hash: revisionLeft }),
    [bucket, name, revisionLeft],
  )

  const right: PackageHandle = React.useMemo(
    () => ({ bucket, name, hash: revisionRight }),
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

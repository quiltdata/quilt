import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import parseSearch from 'utils/parseSearch'
import type { PackageHandle } from 'utils/packageHandle'

import * as FileView from '../FileView'
import WithPackagesSupport from '../WithPackagesSupport'

import * as Diff from './Diff'
import Revisions from './Revisions'
import { useRevision } from './useRevision'

const useStyles = M.makeStyles((t) => ({
  root: {},
  table: {
    marginTop: t.spacing(1),
  },
  summary: {
    marginTop: t.spacing(4),
  },
  details: {
    marginTop: t.spacing(4),
    display: 'flex',
    justifyContent: 'space-between',
  },
  userMeta: {},
  entries: {
    marginTop: t.spacing(4),
  },
}))

interface RevisionsCompareProps {
  left: PackageHandle
  right: PackageHandle
  onLeftChange: (hash: string) => void
  onRightChange: (hash: string) => void
  onSwap: () => void
  changesOnly: boolean
}

export function RevisionsCompare({
  left,
  right,
  onLeftChange,
  onRightChange,
  onSwap,
  changesOnly,
}: RevisionsCompareProps) {
  const classes = useStyles()
  const { push } = RRDom.useHistory()
  const { urls } = NamedRoutes.use()

  const leftRevisionResult = useRevision(left.bucket, left.name, left.hash)
  const rightRevisionResult = useRevision(right.bucket, right.name, right.hash)

  const handleShowChangesOnly = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const options = event.target.checked ? undefined : { showAll: true }
      push(
        urls.bucketPackageCompare(
          left.bucket,
          left.name,
          left.hash,
          right?.hash,
          options,
        ),
      )
    },
    [push, urls, left.bucket, left.name, left.hash, right?.hash],
  )

  return (
    <div className={classes.root}>
      <Revisions
        left={left}
        right={right}
        onLeftChange={onLeftChange}
        onRightChange={onRightChange}
        onSwap={onSwap}
      />

      <div className={classes.summary}>
        <M.Typography variant="h6" gutterBottom>
          What's changed
        </M.Typography>
        <Diff.Summary left={leftRevisionResult} right={rightRevisionResult} />
      </div>

      <M.Typography variant="h6" gutterBottom className={classes.details}>
        Details
        <M.FormControlLabel
          control={<M.Checkbox checked={changesOnly} onChange={handleShowChangesOnly} />}
          label="Show changes only"
        />
      </M.Typography>

      <div className={classes.userMeta}>
        <M.Typography variant="subtitle1" gutterBottom>
          User metadata
        </M.Typography>
        <M.Paper square variant="outlined">
          <Diff.Metadata
            left={leftRevisionResult}
            right={rightRevisionResult}
            changesOnly={changesOnly}
          />
        </M.Paper>
      </div>

      <div className={classes.entries}>
        <M.Typography variant="subtitle1" gutterBottom>
          Entries
        </M.Typography>
        <M.Paper square variant="outlined">
          <Diff.Entries
            left={leftRevisionResult}
            right={rightRevisionResult}
            changesOnly={changesOnly}
          />
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
  const location = RRDom.useLocation()
  const { showAll } = parseSearch(location.search)

  const left = React.useMemo(
    () => ({ bucket, name, hash: revisionLeft }),
    [bucket, name, revisionLeft],
  )

  const right = React.useMemo(
    () => (revisionRight ? { bucket, name, hash: revisionRight } : null),
    [bucket, name, revisionRight],
  )

  const handleLeftChange = React.useCallback(
    (hash: string) =>
      push(
        urls.bucketPackageCompare(bucket, name, hash, revisionRight, {
          showAll,
        }),
      ),
    [bucket, name, push, revisionRight, urls, showAll],
  )
  const handleRightChange = React.useCallback(
    (hash: string) =>
      push(
        urls.bucketPackageCompare(bucket, name, revisionLeft, hash, {
          showAll,
        }),
      ),
    [bucket, name, push, revisionLeft, urls, showAll],
  )
  const handleSwap = React.useCallback(
    () =>
      push(
        urls.bucketPackageCompare(bucket, name, revisionRight, revisionLeft, {
          showAll,
        }),
      ),
    [bucket, name, push, revisionLeft, revisionRight, urls, showAll],
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
          {right ? (
            <RevisionsCompare
              changesOnly={!showAll || showAll === 'false'}
              left={left}
              right={right}
              onLeftChange={handleLeftChange}
              onRightChange={handleRightChange}
              onSwap={handleSwap}
            />
          ) : (
            <Revisions
              left={left}
              right={right}
              onLeftChange={handleLeftChange}
              onRightChange={handleRightChange}
              onSwap={handleSwap}
            />
          )}
        </FileView.Root>
      </WithPackagesSupport>
    </>
  )
}

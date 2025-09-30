import * as dateFns from 'date-fns'
import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'

import ReactDiffViewer from 'react-diff-viewer-continued'
import Skeleton from 'components/Skeleton'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'
import { readableBytes, trimCenter } from 'utils/string'
import type { PackageHandle } from 'utils/packageHandle'

import WithPackagesSupport from '../WithPackagesSupport'
import { displayError } from '../errors'

import REVISION_LIST_QUERY from '../PackageRevisions/gql/RevisionList.generated'
import MANIFEST_QUERY from '../PackageDialog/gql/Manifest.generated'

type RevisionFields = NonNullable<
  NonNullable<
    ResultOf<typeof REVISION_LIST_QUERY>['package']
  >['revisions']['page'][number]
>

const useStyles = M.makeStyles((t) => ({
  table: {
    '& th, & td': {
      border: `1px solid ${t.palette.divider}`,
      padding: t.spacing(1, 2),
    },
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  hash: {
    color: t.palette.text.secondary,
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
    wordBreak: 'break-all',
  },
}))

function RevisionSkeleton() {
  return (
    <>
      <M.TableRow>
        <M.TableCell>
          <Skeleton width={150} height={20} />
        </M.TableCell>
        <M.TableCell>
          <Skeleton width={150} height={20} />
        </M.TableCell>
      </M.TableRow>
      <M.TableRow>
        <M.TableCell>
          <Skeleton width="100%" height={20} />
        </M.TableCell>
        <M.TableCell>
          <Skeleton width="100%" height={20} />
        </M.TableCell>
      </M.TableRow>
      <M.TableRow>
        <M.TableCell>
          <Skeleton width={80} height={20} />
        </M.TableCell>
        <M.TableCell>
          <Skeleton width={80} height={20} />
        </M.TableCell>
      </M.TableRow>
    </>
  )
}

interface RevisionCompareTableProps {
  bucket: string
  name: string
  leftRevision: RevisionFields | null
  rightRevision: RevisionFields | null
}

function RevisionCompareTable({
  bucket,
  name,
  leftRevision,
  rightRevision,
}: RevisionCompareTableProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()

  // Fetch manifests for both revisions
  const leftManifestQuery = GQL.useQuery(
    MANIFEST_QUERY,
    {
      bucket,
      name,
      hashOrTag: leftRevision?.hash || 'latest',
      max: 10000,
      skipEntries: false,
    },
    { pause: !leftRevision?.hash },
  )

  const rightManifestQuery = GQL.useQuery(
    MANIFEST_QUERY,
    {
      bucket,
      name,
      hashOrTag: rightRevision?.hash || 'latest',
      max: 10000,
      skipEntries: false,
    },
    { pause: !rightRevision?.hash },
  )

  const formatDate = (date: Date) => dateFns.format(date, 'MMMM do yyyy - h:mma')

  const renderHash = (revision: RevisionFields | null) => {
    if (!revision) return '-'
    return (
      <M.Box display="flex" alignItems="center">
        <M.Box className={classes.hash} flexGrow={1}>
          {revision.hash}
        </M.Box>
        <M.IconButton
          size="small"
          onClick={() => copyToClipboard(revision.hash)}
          edge="end"
        >
          <M.Icon fontSize="small">file_copy</M.Icon>
        </M.IconButton>
      </M.Box>
    )
  }

  const renderManifestDiff = () => {
    // Check if both manifests have loaded
    const leftData = leftManifestQuery.data?.package?.revision?.contentsFlatMap
    const rightData = rightManifestQuery.data?.package?.revision?.contentsFlatMap

    if (leftManifestQuery.fetching || rightManifestQuery.fetching) {
      return <Skeleton width="100%" height={200} />
    }

    if (leftManifestQuery.error || rightManifestQuery.error) {
      return (
        <M.Typography variant="body2" color="error">
          Error loading manifests
        </M.Typography>
      )
    }

    const leftManifestString = leftData ? JSON.stringify(leftData, null, 2) : ''
    const rightManifestString = rightData ? JSON.stringify(rightData, null, 2) : ''

    // Don't show diff if the manifests are identical
    if (leftManifestString === rightManifestString) {
      return (
        <M.Box>
          <M.Typography
            variant="body2"
            color="textSecondary"
            style={{ fontStyle: 'italic', textAlign: 'center', padding: 16 }}
          >
            Manifest entries are identical
          </M.Typography>
        </M.Box>
      )
    }

    return (
      <M.Box>
        <ReactDiffViewer
          oldValue={leftManifestString}
          newValue={rightManifestString}
          splitView={true}
          leftTitle={leftRevision?.hash ? trimCenter(leftRevision.hash, 15) : 'Left'}
          rightTitle={rightRevision?.hash ? trimCenter(rightRevision.hash, 15) : 'Right'}
          showDiffOnly={false}
          hideLineNumbers={false}
        />
      </M.Box>
    )
  }

  const renderMetadataDiff = () => {
    if (!leftRevision && !rightRevision) {
      return (
        <M.Typography variant="body2" color="textSecondary">
          No revision data available
        </M.Typography>
      )
    }

    const leftMetadata = leftRevision?.userMeta || {}
    const rightMetadata = rightRevision?.userMeta || {}

    const leftMetadataString = JSON.stringify(leftMetadata, null, 2)
    const rightMetadataString = JSON.stringify(rightMetadata, null, 2)

    // Don't show diff if the metadata is identical
    if (leftMetadataString === rightMetadataString) {
      return (
        <M.Box>
          <M.Typography
            variant="body2"
            color="textSecondary"
            style={{ fontStyle: 'italic', textAlign: 'center', padding: 16 }}
          >
            Metadata is identical
          </M.Typography>
        </M.Box>
      )
    }

    return (
      <M.Box>
        <ReactDiffViewer
          oldValue={leftMetadataString}
          newValue={rightMetadataString}
          splitView={true}
          leftTitle={leftRevision?.hash ? trimCenter(leftRevision.hash, 15) : 'Left'}
          rightTitle={rightRevision?.hash ? trimCenter(rightRevision.hash, 15) : 'Right'}
          showDiffOnly={false}
          hideLineNumbers={false}
        />
      </M.Box>
    )
  }

  return (
    <M.Box>
      <M.TableContainer component={M.Paper}>
        <M.Table className={classes.table}>
          <M.TableHead>
            <M.TableRow>
              <M.TableCell component="th" scope="col">
                <M.Typography variant="h6">
                  {leftRevision ? renderHash(leftRevision) : 'Left Revision'}
                </M.Typography>
              </M.TableCell>
              <M.TableCell component="th" scope="col">
                <M.Typography variant="h6">
                  {rightRevision ? renderHash(rightRevision) : 'Right Revision'}
                </M.Typography>
              </M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            <M.TableRow>
              <M.TableCell>
                {leftRevision ? (
                  <StyledLink
                    to={urls.bucketPackageTree(bucket, name, leftRevision.hash)}
                  >
                    {formatDate(leftRevision.modified)}
                  </StyledLink>
                ) : (
                  '-'
                )}
              </M.TableCell>
              <M.TableCell>
                {rightRevision ? (
                  <StyledLink
                    to={urls.bucketPackageTree(bucket, name, rightRevision.hash)}
                  >
                    {formatDate(rightRevision.modified)}
                  </StyledLink>
                ) : (
                  '-'
                )}
              </M.TableCell>
            </M.TableRow>
            <M.TableRow>
              <M.TableCell>
                {leftRevision?.message ? (
                  <M.Typography variant="body2">{leftRevision.message}</M.Typography>
                ) : (
                  <M.Typography
                    variant="body2"
                    color="textSecondary"
                    style={{ fontStyle: 'italic' }}
                  >
                    No message
                  </M.Typography>
                )}
              </M.TableCell>
              <M.TableCell>
                {rightRevision?.message ? (
                  <M.Typography variant="body2">{rightRevision.message}</M.Typography>
                ) : (
                  <M.Typography
                    variant="body2"
                    color="textSecondary"
                    style={{ fontStyle: 'italic' }}
                  >
                    No message
                  </M.Typography>
                )}
              </M.TableCell>
            </M.TableRow>
            <M.TableRow>
              <M.TableCell>
                {leftRevision ? (
                  <M.Typography variant="body2">
                    {readableBytes(leftRevision.totalBytes)}
                  </M.Typography>
                ) : (
                  '-'
                )}
              </M.TableCell>
              <M.TableCell>
                {rightRevision ? (
                  <M.Typography variant="body2">
                    {readableBytes(rightRevision.totalBytes)}
                  </M.Typography>
                ) : (
                  '-'
                )}
              </M.TableCell>
            </M.TableRow>
          </M.TableBody>
        </M.Table>
      </M.TableContainer>

      {/* Metadata Diff Section */}
      <M.Box mt={3}>
        <M.Typography variant="h6" gutterBottom>
          Metadata Comparison
        </M.Typography>
        <M.Paper>{renderMetadataDiff()}</M.Paper>
      </M.Box>

      {/* Entries Diff Section */}
      <M.Box mt={3}>
        <M.Typography variant="h6" gutterBottom>
          Entries Comparison
        </M.Typography>
        <M.Paper>{renderManifestDiff()}</M.Paper>
      </M.Box>
    </M.Box>
  )
}

interface PackageCompareProps {
  left: PackageHandle
  right: PackageHandle
}

export function PackageCompare({ left, right }: PackageCompareProps) {
  const { urls } = NamedRoutes.use()

  // Fetch revision data for both revisions
  const revisionListQuery = GQL.useQuery(REVISION_LIST_QUERY, {
    bucket: left.bucket,
    name: left.name,
    page: 1,
    perPage: 100, // Fetch enough to find our revisions
  })

  // Find the specific revisions we need
  const { leftRevision, rightRevision } = React.useMemo(() => {
    const revisions = revisionListQuery.data?.package?.revisions.page || []
    const leftRev = revisions.find((r) => r.hash === left.hash) || null
    const rightRev = revisions.find((r) => r.hash === right.hash) || null
    return { leftRevision: leftRev, rightRevision: rightRev }
  }, [revisionListQuery.data, left.hash, right.hash])

  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      <M.Box
        pt={{ xs: 2, sm: 3 }}
        pb={{ xs: 2, sm: 1 }}
        px={{ xs: 2, sm: 0 }}
        display="flex"
        alignItems="center"
      >
        <M.Typography variant="h5">
          <StyledLink to={urls.bucketPackageDetail(left.bucket, left.name)}>
            {left.name}
          </StyledLink>{' '}
          revision comparison
        </M.Typography>
      </M.Box>

      <M.Box px={{ xs: 2, sm: 0 }}>
        {GQL.fold(revisionListQuery, {
          error: displayError(),
          fetching: () => (
            <M.Box>
              <M.TableContainer component={M.Paper}>
                <M.Table>
                  <M.TableHead>
                    <M.TableRow>
                      <M.TableCell component="th" scope="col">
                        <M.Typography variant="h6">Left Revision</M.Typography>
                      </M.TableCell>
                      <M.TableCell component="th" scope="col">
                        <M.Typography variant="h6">Right Revision</M.Typography>
                      </M.TableCell>
                    </M.TableRow>
                  </M.TableHead>
                  <M.TableBody>
                    <RevisionSkeleton />
                  </M.TableBody>
                </M.Table>
              </M.TableContainer>

              <M.Box mt={3}>
                <M.Typography variant="h6" gutterBottom>
                  Metadata Comparison
                </M.Typography>
                <M.Paper>
                  <Skeleton width="100%" height={200} />
                </M.Paper>
              </M.Box>

              <M.Box mt={3}>
                <M.Typography variant="h6" gutterBottom>
                  Entries Comparison
                </M.Typography>
                <M.Paper>
                  <Skeleton width="100%" height={200} />
                </M.Paper>
              </M.Box>
            </M.Box>
          ),
          data: () => (
            <RevisionCompareTable
              bucket={left.bucket}
              name={left.name}
              leftRevision={leftRevision}
              rightRevision={rightRevision}
            />
          ),
        })}
      </M.Box>
    </M.Box>
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

  const left: PackageHandle = {
    bucket,
    name,
    hash: revisionLeft,
  }

  const right: PackageHandle = {
    bucket,
    name,
    hash: revisionRight,
  }

  return (
    <>
      <MetaTitle>{[`${name} comparison`, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <PackageCompare left={left} right={right} />
      </WithPackagesSupport>
    </>
  )
}

import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import { Popup } from 'components/Collaborators'
import type * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledTooltip from 'utils/StyledTooltip'
import { formatQuantity, readableBytes } from 'utils/string'

import * as requests from './requests'

import BUCKET_OVERVIEW_URL_QUERY from './gql/BucketOverviewUrl.generated'
import COLLABORATORS_QUERY from './gql/Collaborators.generated'

function PackagesIcon() {
  return (
    <M.SvgIcon
      fontSize="small"
      height="32"
      style={{ width: '16px', height: '16px' }}
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6,2 L26,2 L32,13 L0,13 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />

      <line x1="16" y1="2" x2="16" y2="13" stroke="currentColor" strokeWidth="3" />
      <path
        d="M0,13 H32 V28 A3,3 0 0 1 29,31 H3 A3,3 0 0 1 0,28 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </M.SvgIcon>
  )
}

function useBucketStats(bucket: string) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const { bucketConfig } = GQL.useQueryS(BUCKET_OVERVIEW_URL_QUERY, { bucket })
  const overviewUrl = bucketConfig?.overviewUrl
  return useData(requests.bucketStats, { req, s3, bucket, overviewUrl })
}

function usePackagesStats(bucket: string) {
  const req = APIConnector.use()
  return useData(requests.countPackageRevisions, { req, bucket })
}

function NoCollaborators({ className }: { className: string }) {
  return (
    <StyledTooltip title="Only you can see this bucket">
      <M.IconButton className={className} size="small">
        <M.Icon fontSize="small">visibility_off</M.Icon>
      </M.IconButton>
    </StyledTooltip>
  )
}

const NO_COLLABORATORS: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> = []

function useCollaborators(bucket: string) {
  const result = GQL.useQuery(COLLABORATORS_QUERY, {
    bucket,
  })
  return GQL.fold(result, {
    data: ({ bucketConfig, potentialCollaborators }) => {
      const collaborators = bucketConfig?.collaborators || NO_COLLABORATORS
      return AsyncResult.Ok([
        ...(collaborators || []),
        ...potentialCollaborators.map((collaborator) => ({
          collaborator,
          permissionLevel: undefined,
        })),
      ])
    },
    fetching: () => AsyncResult.Pending(),
    error: (error) => AsyncResult.Err(error),
  })
}

interface CollaboratorsProps {
  bucket: string
  className: string
  collaborators: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection>
}

function Collaborators({ bucket, className, collaborators }: CollaboratorsProps) {
  const hasUnmanagedRole = React.useMemo(
    () => collaborators.find(({ permissionLevel }) => !permissionLevel),
    [collaborators],
  )

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  return (
    <>
      <StyledTooltip title="Number of collaborators">
        <M.Button
          className={className}
          onClick={handleOpen}
          startIcon={<M.Icon>visibility</M.Icon>}
          color="inherit"
        >
          {hasUnmanagedRole ? `${collaborators.length}+` : `${collaborators.length}`}
        </M.Button>
      </StyledTooltip>
      <Popup
        bucket={bucket}
        collaborators={collaborators}
        onClose={handleClose}
        open={open}
      />
    </>
  )
}

interface ChipLoadingProps {
  className: string
}

function ChipLoading({ className }: ChipLoadingProps) {
  return (
    <M.Button
      className={className}
      size="small"
      startIcon={<M.CircularProgress size={16} />}
    >
      ?
    </M.Button>
  )
}

interface ChipErrorProps {
  className: string
  error: Error
}

function ChipError({ className, error }: ChipErrorProps) {
  return (
    <StyledTooltip title={error.message}>
      <M.Button
        className={className}
        size="small"
        startIcon={<M.Icon>error_outline</M.Icon>}
      >
        ?
      </M.Button>
    </StyledTooltip>
  )
}

interface ChipLinkProps {
  className: string
  label: React.ReactNode
  to: string
  icon: string | React.ReactNode
  title: string
}

function ChipLink({ className, icon, label, title, to }: ChipLinkProps) {
  return (
    <StyledTooltip title={title}>
      <M.Button
        className={className}
        color="inherit"
        component={Link}
        size="small"
        startIcon={
          typeof icon === 'string' ? <M.Icon fontSize="small">{icon}</M.Icon> : icon
        }
        to={to}
      >
        {label}
      </M.Button>
    </StyledTooltip>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.secondary,
    display: 'grid',
    alignItems: 'center',
    gridAutoFlow: 'column',
    gridColumnGap: t.spacing(2.5),
  },
  chip: {
    minWidth: 'auto',
  },
}))

interface StatsProps {
  bucket: string
  className: string
}

export default function Stats({ className, bucket }: StatsProps) {
  const classes = useStyles()

  const { urls } = NamedRoutes.use()

  const { result: stats } = useBucketStats(bucket)
  const { result: pkgs } = usePackagesStats(bucket)
  const collaborators = useCollaborators(bucket)

  return (
    <div className={cx(classes.root, className)}>
      {AsyncResult.case(
        {
          Ok: ({ totalBytes }: { totalBytes: number }) => (
            <ChipLink
              className={classes.chip}
              icon="pie_chart_outlined"
              label={readableBytes(totalBytes)}
              title="Total size"
              to={urls.bucketOverview(bucket)}
            />
          ),
          _: () => null,
          Err: (error: Error) => <ChipError className={classes.chip} error={error} />,
          Pending: () => <ChipLoading className={classes.chip} />,
        },
        stats,
      )}

      {AsyncResult.case(
        {
          Ok: ({ totalObjects }: { totalObjects: number }) => (
            <ChipLink
              className={classes.chip}
              icon={<M.Icon fontSize="small">insert_drive_file_outlined</M.Icon>}
              label={readableBytes(totalObjects)}
              title="Number of objects in the bucket"
              to={urls.bucketDir(bucket)}
            />
          ),
          _: () => null,
          Err: (error: Error) => <ChipError className={classes.chip} error={error} />,
          Pending: () => <ChipLoading className={classes.chip} />,
        },
        stats,
      )}

      {AsyncResult.case(
        {
          Ok: (data: number) => (
            <ChipLink
              className={classes.chip}
              icon={<PackagesIcon />}
              label={formatQuantity(data)}
              title="Number of packages in the bucket"
              to={urls.bucketPackageList(bucket)}
            />
          ),
          _: () => null,
          Err: (error: Error) => <ChipError className={classes.chip} error={error} />,
          Pending: () => <ChipLoading className={classes.chip} />,
        },
        pkgs,
      )}

      {AsyncResult.case(
        {
          Ok: (data: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection>) =>
            data.length ? (
              <Collaborators
                bucket={bucket}
                className={classes.chip}
                collaborators={data}
              />
            ) : (
              <NoCollaborators className={classes.chip} />
            ),
          _: () => null,
          Err: (error: Error) => <ChipError className={classes.chip} error={error} />,
          Pending: () => <ChipLoading className={classes.chip} />,
        },
        collaborators,
      )}
    </div>
  )
}

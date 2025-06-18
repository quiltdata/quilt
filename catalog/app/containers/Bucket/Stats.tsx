import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import AsyncResult from 'utils/AsyncResult'
import StyledTooltip from 'utils/StyledTooltip'

import { Popup } from 'components/Collaborators'

import COLLABORATORS_QUERY from './gql/Collaborators.generated'

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

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
  },
  chip: {},
}))

interface StatsProps {
  bucket: string
  className: string
}

export default function Stats({ className, bucket }: StatsProps) {
  const classes = useStyles()
  const collaborators = useCollaborators(bucket)

  return (
    <div className={cx(classes.root, className)}>
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

import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { docs } from 'constants/urls'
import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import { Alert } from './Components'
import * as Model from './model'
import * as storage from './model/storage'

const LOAD_MORE = 'load-more'

interface WorkgroupSelectProps {
  bucket: string
  disabled?: boolean
  onLoadMore: (workgroups: Model.List<Model.Workgroup>) => void
  value: Model.Workgroup
  workgroups: Model.List<Model.Workgroup>
}

function WorkgroupSelect({
  bucket,
  disabled,
  onLoadMore,
  value,
  workgroups,
}: WorkgroupSelectProps) {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()

  const goToWorkgroup = React.useCallback(
    (workgroup: string) => {
      history.push(urls.bucketAthenaWorkgroup(bucket, workgroup))
    },
    [bucket, history, urls],
  )

  const handleChange = React.useCallback(
    (event) => {
      if (event.target.value === LOAD_MORE) {
        onLoadMore(workgroups)
      } else {
        storage.setWorkgroup(event.target.value)
        goToWorkgroup(event.target.value)
      }
    },
    [goToWorkgroup, onLoadMore, workgroups],
  )

  return (
    <M.FormControl fullWidth>
      <M.InputLabel>Select workgroup</M.InputLabel>
      <M.Select
        disabled={disabled || !workgroups.list.length}
        onChange={handleChange}
        value={value}
      >
        {workgroups.list.map((name) => (
          <M.MenuItem key={name} value={name}>
            <M.ListItemText>{name}</M.ListItemText>
          </M.MenuItem>
        ))}
        {workgroups.next && (
          <M.MenuItem key={LOAD_MORE} value={LOAD_MORE}>
            <M.ListItemText>
              <em>Load more</em>
            </M.ListItemText>
          </M.MenuItem>
        )}
      </M.Select>
    </M.FormControl>
  )
}

interface WorkgroupsEmptyProps {
  error?: Error
}

function WorkgroupsEmpty({ error }: WorkgroupsEmptyProps) {
  return (
    <>
      {error ? (
        <Alert title={error.name} error={error} />
      ) : (
        <Lab.Alert severity="info">
          <Lab.AlertTitle>
            No Athena workgroup available. Please ask an AWS Administrator to create one
            with an appropriate OutputLocation
          </Lab.AlertTitle>
        </Lab.Alert>
      )}

      <M.Box mt={1}>
        <M.Typography variant="body2">
          Check{' '}
          <StyledLink href={`${docs}/quilt-platform-catalog-user/advanced/athena`}>
            Athena Queries docs
          </StyledLink>{' '}
          on setup and correct usage
        </M.Typography>
      </M.Box>
    </>
  )
}

interface AthenaWorkgroupsProps {
  bucket: string
}

export default function AthenaWorkgroups({ bucket }: AthenaWorkgroupsProps) {
  const { queryRun, workgroup, workgroups } = Model.use()

  const selected = workgroup.data
  const list = workgroups.data

  if (!Model.isReady(list) || !Model.isReady(selected)) {
    return (
      <>
        <Skeleton height={24} width={128} animate />
        <Skeleton height={48} mt={1} animate />
      </>
    )
  }

  if (Model.isError(list)) return <WorkgroupsEmpty error={list.error} />
  if (Model.isError(selected)) return <WorkgroupsEmpty error={selected.error} />

  if (!list.data.list.length) return <WorkgroupsEmpty />

  return (
    <WorkgroupSelect
      disabled={Model.isLoading(queryRun)}
      bucket={bucket}
      onLoadMore={workgroups.loadMore}
      value={selected.data}
      workgroups={list.data}
    />
  )
}

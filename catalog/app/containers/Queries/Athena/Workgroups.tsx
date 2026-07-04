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

interface WorkgroupSelectProps {
  disabled?: boolean
  value: Model.Workgroup | null
  workgroups: Model.List<Model.Workgroup>
}

function WorkgroupSelect({ disabled, value, workgroups }: WorkgroupSelectProps) {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()
  const location = RRDom.useLocation()

  const goToWorkgroup = React.useCallback(
    (workgroup: string) => {
      // Preserve the query string (e.g. the ?bucket= tabulator scope) across
      // workgroup switches.
      history.push({
        pathname: urls.queriesAthenaWorkgroup(workgroup),
        search: location.search,
      })
    },
    [history, location.search, urls],
  )

  const handleChange = React.useCallback(
    (event) => {
      storage.setWorkgroup(event.target.value)
      goToWorkgroup(event.target.value)
    },
    [goToWorkgroup],
  )

  return (
    <M.FormControl fullWidth>
      <M.InputLabel>Select workgroup</M.InputLabel>
      <M.Select
        disabled={disabled || !workgroups.list.length}
        onChange={handleChange}
        value={value || 'none'}
      >
        {workgroups.list.map((name) => (
          <M.MenuItem key={name} value={name}>
            <M.ListItemText>{name}</M.ListItemText>
          </M.MenuItem>
        ))}
      </M.Select>
      {!value && <M.FormHelperText>Select a workgroup to run queries</M.FormHelperText>}
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

export default function AthenaWorkgroups() {
  const { queryRun, workgroup, workgroups } = Model.use()

  // A genuine failure while listing workgroups stays a hard error.
  if (Model.isError(workgroups.data)) return <WorkgroupsEmpty error={workgroups.data} />

  // Still loading the list, or resolving which workgroup is current.
  if (!Model.hasData(workgroups.data) || !Model.isReady(workgroup.data)) {
    return (
      <>
        <Skeleton height={24} width={128} animate />
        <Skeleton height={48} mt={1} animate />
      </>
    )
  }

  // No workgroup selected or available (e.g. workspace scope with no context):
  // render the selector with a neutral "Select a workgroup to run queries"
  // prompt rather than a red "Workgroup not found" error banner. `useWorkgroup`
  // resolves to an Error only when the list is empty, so a disabled/empty
  // selector reads as the graceful prompt state.
  return (
    <WorkgroupSelect
      disabled={Model.isLoading(queryRun)}
      value={Model.hasData(workgroup.data) ? workgroup.data : null}
      workgroups={workgroups.data}
    />
  )
}

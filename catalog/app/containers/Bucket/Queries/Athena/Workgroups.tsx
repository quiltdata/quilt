import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as requests from '../requests'

import { Alert, Section } from './Components'

const useStyles = M.makeStyles((t) => ({
  selectWrapper: {
    width: '100%',
  },
  select: {
    padding: t.spacing(1),
  },
}))

const LOAD_MORE = 'load-more'

interface WorkgroupSelectProps {
  bucket: string
  onLoadMore: (workgroups: requests.athena.WorkgroupsResponse) => void
  value: requests.athena.Workgroup | null
  workgroups: requests.athena.WorkgroupsResponse
}

function WorkgroupSelect({
  bucket,
  onLoadMore,
  value,
  workgroups,
}: WorkgroupSelectProps) {
  const classes = useStyles()
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
        goToWorkgroup(event.target.value)
      }
    },
    [goToWorkgroup, onLoadMore, workgroups],
  )

  return (
    <M.Paper>
      <M.FormControl className={classes.selectWrapper}>
        <M.Select
          classes={{ root: classes.select }}
          disabled={!workgroups.list.length}
          onChange={handleChange}
          value={value || 'none'}
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
    </M.Paper>
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

      {/* <M.Typography> // TODO: uncomment on docs deploy
        Check{' '}
        <StyledLink href={`${urls.docs}/catalog/queries#athena`}>
          Athena Queries docs
        </StyledLink>{' '}
        on correct usage
      </M.Typography> */}
    </>
  )
}

interface RedirectToDefaultWorkgroupProps {
  bucket: string
  workgroups: requests.athena.WorkgroupsResponse
}

function RedirectToDefaultWorkgroup({
  bucket,
  workgroups,
}: RedirectToDefaultWorkgroupProps) {
  const { urls } = NamedRoutes.use()
  return (
    <RRDom.Redirect
      to={urls.bucketAthenaWorkgroup(bucket, workgroups.defaultWorkgroup)}
    />
  )
}

interface AthenaWorkgroupsProps {
  bucket: string
  workgroup: requests.athena.Workgroup | null
}

export default function AthenaWorkgroups({ bucket, workgroup }: AthenaWorkgroupsProps) {
  const [prev, setPrev] = React.useState<requests.athena.WorkgroupsResponse | null>(null)
  const data = requests.athena.useWorkgroups(prev)
  return data.case({
    Ok: (workgroups) => {
      if (!workgroup && workgroups.defaultWorkgroup)
        return <RedirectToDefaultWorkgroup bucket={bucket} workgroups={workgroups} />
      return (
        <Section title="Select workgroup" empty={<WorkgroupsEmpty />}>
          {workgroups.list.length && (
            <WorkgroupSelect
              bucket={bucket}
              onLoadMore={setPrev}
              value={workgroup}
              workgroups={workgroups}
            />
          )}
        </Section>
      )
    },
    Err: (error) => <WorkgroupsEmpty error={error} />,
    _: () => (
      <>
        <Skeleton height={24} width={128} animate />
        <Skeleton height={48} mt={1} animate />
      </>
    ),
  })
}

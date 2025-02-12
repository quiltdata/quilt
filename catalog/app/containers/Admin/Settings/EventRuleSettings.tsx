import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import Skeleton from 'components/Skeleton'
import { docs } from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'

import EventRuleToggleROCrate from './gql/EventRuleToggleROCrate.generated'
import EventRuleToggleOmics from './gql/EventRuleToggleOmics.generated'
import EventRuleStatusROCrate from './gql/EventRuleStatusROCrate.generated'
import EventRuleStatusOmics from './gql/EventRuleStatusOmics.generated'

interface ToggleROCrateProps {
  checked: boolean
}

interface ToggleOmicsProps {
  checked: boolean
}

function ToggleROCrate({ checked }: ToggleROCrateProps) {
  const { push: notify } = Notifications.use()
  const mutate = GQL.useMutation(EventRuleToggleROCrate)
  const [mutation, setMutation] = React.useState<{ enabled: boolean } | null>(null)

  const handleChange = React.useCallback(
    async (_event, enabled: boolean) => {
      if (mutation) return
      setMutation({ enabled })
      try {
        await mutate({ enableRule: enabled })
      } catch (e) {
        Sentry.captureException(e)
        notify(`Failed to update event rule settings: ${e}`)
      } finally {
        setMutation(null)
      }
    },
    [mutate, notify, mutation],
  )

  return (
    <>
      <M.FormControlLabel
        control={
          <M.Switch
            checked={mutation?.enabled ?? checked}
            onChange={handleChange}
            disabled={!!mutation}
          />
        }
        label="Enable event rule for RO Crate"
      />
      <M.FormHelperText>
        When enabled, the event rule will be triggered when a new RO Crate is uploaded.
        <StyledLink
          href={`${docs}/advanced-features/notifications#event-rules`}
          target="_blank"
        >
          Learn more
        </StyledLink>
      </M.FormHelperText>
    </>
  )
}

function ToggleOmics({ checked }: ToggleOmicsProps) {
  const { push: notify } = Notifications.use()
  const mutate = GQL.useMutation(EventRuleToggleOmics)
  const [mutation, setMutation] = React.useState<{ enabled: boolean } | null>(null)

  const handleChange = React.useCallback(
    async (_event, enabled: boolean) => {
      if (mutation) return
      setMutation({ enabled })
      try {
        await mutate({ enableRule: enabled })
      } catch (e) {
        Sentry.captureException(e)
        notify(`Failed to update event rule settings: ${e}`)
      } finally {
        setMutation(null)
      }
    },
    [mutate, notify, mutation],
  )

  return (
    <>
      <M.FormControlLabel
        control={
          <M.Switch
            checked={mutation?.enabled ?? checked}
            onChange={handleChange}
            disabled={!!mutation}
          />
        }
        label="Enable event rule for Omics"
      />
      <M.FormHelperText>
        When enabled, the event rule will be triggered when a new Omics file is uploaded.
        <StyledLink
          href={`${docs}/advanced-features/notifications#event-rules`}
          target="_blank"
        >
          Learn more
        </StyledLink>
      </M.FormHelperText>
    </>
  )
}

export default function EventRuleSettings() {
  const ROCRATE_QUERY = GQL.useQuery(EventRuleStatusROCrate)
  const OMICS_QUERY = GQL.useQuery(EventRuleStatusOmics)

  return (
    <M.FormGroup>
      {GQL.fold(ROCRATE_QUERY, {
        data: ({ admin }) => (
          <ToggleROCrate
            checked={
              (admin.eventRuleStatus?.__typename === 'EventRuleStatusSucces' &&
                admin.eventRuleStatus.enabled) ||
              false
            }
          />
        ),
        fetching: () => (
          <>
            <Skeleton width="40%" height={38} />
            <Skeleton width="80%" height={20} mt="3px" />
          </>
        ),
        error: (e) => (
          <Lab.Alert severity="error">
            Could not fetch RO Crate settings:
            <br />
            {e.message}
          </Lab.Alert>
        ),
      })}
      {GQL.fold(OMICS_QUERY, {
        data: ({ admin }) => (
          <ToggleOmics
            checked={
              (admin.eventRuleStatus?.__typename === 'EventRuleStatusSucces' &&
                admin.eventRuleStatus.enabled) ||
              false
            }
          />
        ),
        fetching: () => (
          <>
            <Skeleton width="40%" height={38} />
            <Skeleton width="80%" height={20} mt="3px" />
          </>
        ),
        error: (e) => (
          <Lab.Alert severity="error">
            Could not fetch Omics settings:
            <br />
            {e.message}
          </Lab.Alert>
        ),
      })}
    </M.FormGroup>
  )
}

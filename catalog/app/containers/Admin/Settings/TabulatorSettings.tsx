import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import Skeleton from 'components/Skeleton'
import { docs } from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'

import OPEN_QUERY_QUERY from './gql/TabulatorOpenQuery.generated'
import SET_OPEN_QUERY_MUTATION from './gql/SetTabulatorOpenQuery.generated'
import { useEventRuleToggle } from './gql/EventRuleQuery.generated'
import { useEventRuleToggleMutation } from './gql/SetEventRule.generated'

interface ToggleProps {
  checked: boolean
}

function Toggle({ checked }: ToggleProps) {
  const { push: notify } = Notifications.use()
  const mutate = GQL.useMutation(SET_OPEN_QUERY_MUTATION)
  const [mutation, setMutation] = React.useState<{ enabled: boolean } | null>(null)

  const handleChange = React.useCallback(
    async (_event, enabled: boolean) => {
      if (mutation) return
      setMutation({ enabled })
      try {
        await mutate({ enabled })
      } catch (e) {
        Sentry.captureException(e)
        notify(`Failed to update tabulator settings: ${e}`)
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
        label="Enable open querying of Tabulator tables"
      />
      <M.FormHelperText>
        <b>CAUTION:</b> When enabled, Tabulator defers all access control to AWS and does
        not enforce any extra restrictions.{' '}
        <StyledLink
          href={`${docs}/advanced-features/tabulator#open-query`}
          target="_blank"
        >
          Learn more
        </StyledLink>{' '}
        in the documentation.
      </M.FormHelperText>
    </>
  )
}

enum EventRuleType {
  OMICS = 'OMICS',
  ROCRATE = 'ROCRATE'
}

interface EventRuleState {
  OMICS: boolean
  ROCRATE: boolean
}

interface EventRuleToggleProps {
  type: EventRuleType
  checked: boolean
  disabled?: boolean
}

function EventRuleToggle({ type, checked, disabled }: EventRuleToggleProps) {
  const { push: notify } = Notifications.use()
  const [toggleEventRule] = useEventRuleToggleMutation()
  const [mutation, setMutation] = React.useState<{ enabled: boolean } | null>(null)

  const handleChange = React.useCallback(
    async (_event, enabled: boolean) => {
      if (mutation) return
      setMutation({ enabled })
      try {
        await toggleEventRule({ 
          variables: { 
            ruleType: type,
            enableRule: enabled
          }
        })
      } catch (e) {
        Sentry.captureException(e)
        notify(`Failed to update ${type.toLowerCase()} event rule settings: ${e}`)
      } finally {
        setMutation(null)
      }
    },
    [mutate, notify, mutation, type],
  )

  const label = type === EventRuleType.OMICS 
    ? "Enable event rules for Omics package events"
    : "Enable event rules for RO-Crate package events"

  return (
    <>
      <M.FormControlLabel
        control={
          <M.Switch
            checked={mutation?.enabled ?? checked}
            onChange={handleChange}
            disabled={disabled || !!mutation}
          />
        }
        label={label}
      />
      <M.FormHelperText>
        When enabled, {type.toLowerCase()} package events will trigger configured event rules.{' '}
        <StyledLink href={`${docs}/advanced-features/events#${type.toLowerCase()}`} target="_blank">
          Learn more
        </StyledLink>{' '}
        in the documentation.
      </M.FormHelperText>
    </>
  )
}

export default function TabulatorSettings() {
  const tabulatorQuery = GQL.useQuery(OPEN_QUERY_QUERY)
  const eventRuleQuery = useEventRuleToggle()

  return (
    <M.FormGroup>
      {GQL.fold(tabulatorQuery, {
        data: ({ admin }) => <Toggle checked={admin.tabulatorOpenQuery} />,
        fetching: () => (
          <>
            <Skeleton width="40%" height={38} />
            <Skeleton width="80%" height={20} mt="3px" />
          </>
        ),
        error: (e) => (
          <Lab.Alert severity="error">
            Could not fetch tabulator settings:
            <br />
            {e.message}
          </Lab.Alert>
        ),
      })}
      <M.Box mt={2}>
        {GQL.fold(eventRuleQuery, {
          data: ({ admin }) => (
            <>
              <EventRuleToggle 
                type={EventRuleType.OMICS}
                checked={admin.eventRuleEnabled.OMICS}
              />
              <M.Box mt={2}>
                <EventRuleToggle
                  type={EventRuleType.ROCRATE}
                  checked={admin.eventRuleEnabled.ROCRATE}
                />
              </M.Box>
            </>
          ),
          fetching: () => (
            <>
              <Skeleton width="40%" height={38} />
              <Skeleton width="80%" height={20} mt="3px" />
              <M.Box mt={2}>
                <Skeleton width="40%" height={38} />
                <Skeleton width="80%" height={20} mt="3px" />
              </M.Box>
            </>
          ),
          error: (e) => (
            <Lab.Alert severity="error">
              Could not fetch event rule settings:
              <br />
              {e.message}
            </Lab.Alert>
          ),
        })}
      </M.Box>
    </M.FormGroup>
  )
}

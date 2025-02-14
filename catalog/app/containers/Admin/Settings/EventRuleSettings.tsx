import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'

import { EventRuleType } from 'model/graphql/types.generated'
import EventRuleToggle from './gql/EventRuleToggle.generated'
import EventRuleStatus from './gql/EventRuleStatus.generated'

interface ToggleProps {
  ruleType: EventRuleType
  enableRule: boolean
}

const descriptions = {
  [EventRuleType.OMICS]: 'Package Omics completion events',
  [EventRuleType.ROCRATE]: 'Package Nextflow runs (with nf-prov WorkflowRun RO Crates)',
}

const Toggle: React.FC<ToggleProps> = ({ ruleType, enableRule }) => {
  const { push: notify } = Notifications.use()
  const toggle = GQL.useMutation(EventRuleToggle)
  const [mutation, setMutation] = React.useState<{ enabled: boolean } | null>(null)
  const [localEnabled, setLocalEnabled] = React.useState(enableRule)

  const handleChange = React.useCallback(
    async (_event, enabled: boolean) => {
      if (mutation) return
      setMutation({ enabled })
      setLocalEnabled(enabled)
      try {
        await toggle({ ruleType, enableRule: enabled })
      } catch (e) {
        setLocalEnabled(!enabled)
        Sentry.captureException(e)
        notify(`Failed to update event rule settings: ${e}`)
      } finally {
        setMutation(null)
      }
    },
    [toggle, notify, mutation, ruleType],
  )

  return (
    <M.FormControlLabel
      control={
        <M.Switch checked={localEnabled} onChange={handleChange} disabled={!!mutation} />
      }
      label={descriptions[ruleType]}
    />
  )
}

export default function EventRuleSettings() {
  const query = GQL.useQuery(EventRuleStatus)

  return (
    <M.FormGroup>
      {GQL.fold(query, {
        data: ({ admin }) => (
          <>
            <Toggle
              ruleType={EventRuleType.OMICS}
              enableRule={
                admin.omics.__typename === 'EventRuleStatusSuccess'
                  ? admin.omics.enabled
                  : false
              }
            />
            <Toggle
              ruleType={EventRuleType.ROCRATE}
              enableRule={
                admin.rocrate.__typename === 'EventRuleStatusSuccess'
                  ? admin.rocrate.enabled
                  : false
              }
            />
          </>
        ),
        fetching: () => (
          <>
            <Skeleton width="40%" height={38} />
            <Skeleton width="80%" height={20} mt="3px" />
          </>
        ),
        error: (e) => (
          <Lab.Alert severity="error">
            Could not fetch Auto-Packaging settings:
            <br />
            {e.message}
          </Lab.Alert>
        ),
      })}
    </M.FormGroup>
  )
}

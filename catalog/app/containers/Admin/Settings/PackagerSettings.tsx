import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'

import RULES_QUERY from './gql/PackagerEventRules.generated'
import TOGGLE_RULE_MUTATION from './gql/PackagerToggleEventRule.generated'

// TODO: get descriptions from the backend
// const descriptions = {
//   omics: 'Package Omics completion events',
//   ro_crate: 'Package Nextflow runs (with nf-prov WorkflowRun RO Crates)',
// }

interface ToggleProps {
  name: string
  enabled: boolean
}

function Toggle({ name, enabled }: ToggleProps) {
  const { push: notify } = Notifications.use()
  const toggle = GQL.useMutation(TOGGLE_RULE_MUTATION)
  const [mutation, setMutation] = React.useState<{ enabled: boolean } | null>(null)

  const handleChange = React.useCallback(
    async (_event, checked: boolean) => {
      if (mutation) return
      setMutation({ enabled: checked })
      try {
        await toggle({ name, enabled: checked })
      } catch (e) {
        Sentry.captureException(e)
        notify(`Failed to update event rule settings: ${e}`)
      } finally {
        setMutation(null)
      }
    },
    [toggle, notify, mutation, name],
  )

  return (
    <M.FormControlLabel
      control={
        <M.Switch
          checked={mutation?.enabled ?? enabled}
          onChange={handleChange}
          disabled={!!mutation}
        />
      }
      // TODO: get description from the backend
      label={name}
    />
  )
}

export default function PackagerSettings() {
  const query = GQL.useQuery(RULES_QUERY)

  return (
    <M.FormGroup>
      {/* TODO: docs link? */}
      <M.FormHelperText>
        When enabled, these rules automatically create packages when the corresponding
        events are received.
        <br />
        Subscribe to AUTO_PACKAGING_TOPIC_ARN to be notified when the packaging begins and
        ends.
      </M.FormHelperText>
      {GQL.fold(query, {
        data: (d) =>
          d.admin.packager.eventRules.map((rule) => (
            <Toggle key={rule.name} name={rule.name} enabled={rule.enabled} />
          )),
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

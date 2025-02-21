import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import Skeleton from 'components/Skeleton'
import { docs } from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'

import RULES_QUERY from './gql/PackagerEventRules.generated'
import TOGGLE_RULE_MUTATION from './gql/PackagerToggleEventRule.generated'

const LABELS = {
  omics: (
    <>
      Auto-package{' '}
      <StyledLink
        href="https://docs.aws.amazon.com/omics/latest/dev/eventbridge.html"
        target="_blank"
      >
        AWS HealthOmics
      </StyledLink>{' '}
      outputs
    </>
  ),
  ro_crate: (
    <>
      Auto-package Nextflow outputs (requires nf-prov with{' '}
      <StyledLink
        href="https://github.com/nextflow-io/nf-prov/blob/main/docs/WRROC.md"
        target="_blank"
      >
        Workflow Run RO-Crates
      </StyledLink>
      )
    </>
  ),
}

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
      label={LABELS[name as keyof typeof LABELS] || name}
    />
  )
}

export default function PackagerSettings() {
  const query = GQL.useQuery(RULES_QUERY)

  return (
    <M.FormGroup>
      {GQL.fold(query, {
        data: (d) => (
          <>
            {d.admin.packager.eventRules.map((rule) => (
              <Toggle key={rule.name} {...rule} />
            ))}
            <M.FormHelperText>
              When enabled, these rules automatically create packages when the
              corresponding events are received.{' '}
              <StyledLink
                href={`${docs}/quilt-platform-catalog-user/packaging`}
                target="_blank"
              >
                Learn more
              </StyledLink>{' '}
              in the documentation.
            </M.FormHelperText>
          </>
        ),
        fetching: () => (
          <>
            <Skeleton width="60%" height={24} my="7px" />
            <Skeleton width="40%" height={24} my="7px" />
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

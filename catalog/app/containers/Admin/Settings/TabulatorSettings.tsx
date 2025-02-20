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
          href={`${docs}/quilt-platform-administrator/advanced/tabulator#open-query`}
          target="_blank"
        >
          Learn more
        </StyledLink>{' '}
        in the documentation.
      </M.FormHelperText>
    </>
  )
}

export default function TabulatorSettings() {
  const query = GQL.useQuery(OPEN_QUERY_QUERY)

  return (
    <M.FormGroup>
      {GQL.fold(query, {
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
    </M.FormGroup>
  )
}

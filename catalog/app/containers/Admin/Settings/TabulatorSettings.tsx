import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Sentry from '@sentry/react'

import Skeleton from 'components/Skeleton'
import { docs } from 'constants/urls'
import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'

import UNRESTRICTED_QUERY from './gql/TabulatorUnrestricted.generated'
import SET_UNRESTRICTED_MUTATION from './gql/SetTabulatorUnrestricted.generated'

interface ToggleProps {
  checked: boolean
}

const NONE = Eff.Option.none<{ value: boolean }>()

function Toggle({ checked }: ToggleProps) {
  const { push: notify } = Notifications.use()
  const mutate = GQL.useMutation(SET_UNRESTRICTED_MUTATION)
  const [mutationState, setMutationState] = React.useState(NONE)

  const handleChange = React.useCallback(
    async (_event, value: boolean) => {
      if (Eff.Option.isSome(mutationState)) return
      setMutationState(Eff.Option.some({ value }))
      try {
        await mutate({ value })
      } catch (e) {
        Sentry.captureException(e)
        notify(`Failed to update tabulator settings: ${e}`)
      } finally {
        setMutationState(NONE)
      }
    },
    [mutate, notify, mutationState, setMutationState],
  )

  const value = Eff.pipe(
    mutationState,
    Eff.Option.map((x) => x.value),
    Eff.Option.getOrElse(() => checked),
  )

  return (
    <>
      <M.FormControlLabel
        control={
          <M.Switch
            checked={value}
            onChange={handleChange}
            disabled={Eff.Option.isSome(mutationState)}
          />
        }
        label="Enable unrestricted access"
      />
      <M.FormHelperText>
        <b>CAUTION:</b> When enabled, Tabulator defers all access control to AWS and does
        not enforce any extra restrictions.{' '}
        <StyledLink
          href={`${docs}/advanced-features/tabulator#unrestricted-access`}
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
  const query = GQL.useQuery(UNRESTRICTED_QUERY)

  return (
    <M.FormGroup>
      {GQL.fold(query, {
        data: ({ admin }) => <Toggle checked={admin.tabulatorUnrestricted} />,
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

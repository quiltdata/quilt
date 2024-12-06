import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'

// import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'

import UNRESTRICTED_QUERY from './gql/TabulatorUnrestricted.generated'
import SET_UNRESTRICTED_MUTATION from './gql/SetTabulatorUnrestricted.generated'

type DisabledReason = Eff.Data.TaggedEnum<{
  Loading: {}
  Error: { readonly error: string }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
const DisabledReason = Eff.Data.taggedEnum<DisabledReason>()

export default function TabulatorSettings() {
  const query = GQL.useQuery(UNRESTRICTED_QUERY)

  const mutate = GQL.useMutation(SET_UNRESTRICTED_MUTATION)

  const handleChange = React.useCallback(
    async (event, value: boolean) => {
      await mutate({ value })
    },
    [mutate],
  )

  const checked = GQL.fold(query, {
    data: ({ admin }) => admin.tabulatorUnrestricted,
    fetching: () => false,
    error: () => false,
  })

  const disabledReason: Eff.Option.Option<DisabledReason> = GQL.fold(query, {
    data: () => Eff.Option.none(),
    fetching: () => Eff.Option.some(DisabledReason.Loading()),
    error: (e) => Eff.Option.some(DisabledReason.Error({ error: e.message })),
  })

  // TODO: show a spinner when disabledReason is Loading
  // TODO: show an error message when disabledReason is Error
  return (
    <M.FormGroup>
      <M.FormControlLabel
        control={
          <M.Switch
            checked={checked}
            onChange={handleChange}
            disabled={Eff.Option.isSome(disabledReason)}
          />
        }
        label="Enable unrestricted access"
      />
      <M.FormHelperText>
        When enabled, all athena users will have access to all the configured tables. doc
        link tbd
      </M.FormHelperText>
    </M.FormGroup>
  )
}

import * as Types from 'model/graphql/types.generated'
import * as Operations from '@graphql/operations'
import * as Apollo from '@apollo/client'

export const EventRuleQueryDocument = /* GraphQL */ `
  query EventRuleQuery {
    admin {
      eventRuleEnabled
    }
  }
`

export type EventRuleQueryQuery = {
  admin: { eventRuleEnabled: boolean }
}

export function useEventRuleQuery(
  baseOptions?: Apollo.QueryHookOptions<EventRuleQueryQuery>,
) {
  const options = { ...baseOptions }
  return Apollo.useQuery<EventRuleQueryQuery>(EventRuleQueryDocument, options)
}

export type EventRuleQueryQueryHookResult = ReturnType<typeof useEventRuleQuery>

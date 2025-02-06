import * as Types from 'model/graphql/types.generated'
import * as Operations from '@graphql/operations'
import * as Apollo from '@apollo/client'

export const EventRuleToggleDocument = /* GraphQL */ `
  query EventRuleToggle {
    admin {
      eventRuleEnabled {
        OMICS
        ROCRATE
      }
    }
  }
`

export type EventRuleToggleQuery = {
  admin: { 
    eventRuleEnabled: {
      OMICS: boolean
      ROCRATE: boolean
    }
  }
}

export function useEventRuleToggle(
  baseOptions?: Apollo.QueryHookOptions<EventRuleToggleQuery>,
) {
  const options = { ...baseOptions }
  return Apollo.useQuery<EventRuleToggleQuery>(EventRuleToggleDocument, options)
}

export type EventRuleToggleQueryHookResult = ReturnType<typeof useEventRuleToggle>

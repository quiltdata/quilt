import * as Types from 'model/graphql/types.generated'
import * as Operations from '@graphql/operations'
import * as Apollo from '@apollo/client'

export const EventRuleToggleMutationDocument = /* GraphQL */ `
  mutation EventRuleToggle($ruleType: EventRuleType!, $enableRule: Boolean!) {
    admin {
      eventRuleToggle(ruleType: $ruleType, enableRule: $enableRule) {
        OMICS
        ROCRATE
      }
    }
  }
`

export type EventRuleToggleMutationVariables = {
  ruleType: EventRuleType
  enableRule: boolean
}

export type EventRuleToggleMutation = {
  admin: { 
    eventRuleToggle: {
      OMICS: boolean
      ROCRATE: boolean
    }
  }
}

export function useEventRuleToggleMutation(
  baseOptions?: Apollo.MutationHookOptions<EventRuleToggleMutation, EventRuleToggleMutationVariables>,
) {
  const options = { ...baseOptions }
  return Apollo.useMutation<EventRuleToggleMutation, EventRuleToggleMutationVariables>(
    EventRuleToggleMutationDocument,
    options,
  )
}

export type EventRuleToggleMutationHookResult = ReturnType<typeof useEventRuleToggleMutation>

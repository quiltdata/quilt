import * as Types from 'model/graphql/types.generated'
import * as Operations from '@graphql/operations'
import * as Apollo from '@apollo/client'

export const SetEventRuleMutationDocument = /* GraphQL */ `
  mutation SetEventRuleMutation($enabled: Boolean!) {
    admin {
      setEventRule(enabled: $enabled)
    }
  }
`

export type SetEventRuleMutationMutationVariables = {
  enabled: boolean
}

export type SetEventRuleMutationMutation = {
  admin: { setEventRule: boolean }
}

export function useSetEventRuleMutation(
  baseOptions?: Apollo.MutationHookOptions<SetEventRuleMutationMutation, SetEventRuleMutationMutationVariables>,
) {
  const options = { ...baseOptions }
  return Apollo.useMutation<SetEventRuleMutationMutation, SetEventRuleMutationMutationVariables>(
    SetEventRuleMutationDocument,
    options,
  )
}

export type SetEventRuleMutationMutationHookResult = ReturnType<typeof useSetEventRuleMutation>

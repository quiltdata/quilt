import * as React from 'react'

import * as Model from 'model'

import useQuery from './useQuery'
import POTENTIAL_COLLABORATORS from './PotentialCollaborators.generated'

export default function usePotentialCollaborators(): ReadonlyArray<Model.PotentialCollaborator> {
  const potentialCollaboratorsQuery = useQuery({
    query: POTENTIAL_COLLABORATORS,
  })
  return React.useMemo(
    () =>
      potentialCollaboratorsQuery.data?.potentialCollaborators?.map((collaborator) => ({
        collaborator,
        permissionLevel: undefined,
      })) || [],
    [potentialCollaboratorsQuery],
  )
}

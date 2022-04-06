import * as Model from 'model'

import useQuery from './useQuery'
import POTENTIAL_COLLABORATORS from './PotentialCollaborators.generated'

export default function usePotentialCollaborators(): ReadonlyArray<Model.GQLTypes.PotentialCollaboratorBucketConnection> {
  const potentialCollaboratorsQuery = useQuery({
    query: POTENTIAL_COLLABORATORS,
  })
  return potentialCollaboratorsQuery.data?.potentialCollaborators || []
}

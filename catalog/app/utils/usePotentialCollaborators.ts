import * as Model from 'model'

import useQuery from './useQuery'
import POTENTIAL_COLLABORATORS from './PotentialCollaborators.generated'

const NO_COLLABORATORS: ReadonlyArray<Model.GQLTypes.Collaborator> = []

export default function usePotentialCollaborators(): ReadonlyArray<Model.GQLTypes.Collaborator> {
  const potentialCollaboratorsQuery = useQuery({
    query: POTENTIAL_COLLABORATORS,
  })
  return potentialCollaboratorsQuery.data?.potentialCollaborators || NO_COLLABORATORS
}

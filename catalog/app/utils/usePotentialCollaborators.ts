import type * as Model from 'model'
import { useQuery } from 'utils/GraphQL'

import POTENTIAL_COLLABORATORS from './PotentialCollaborators.generated'

const NO_COLLABORATORS: ReadonlyArray<Model.GQLTypes.Collaborator> = []

export default function usePotentialCollaborators(): ReadonlyArray<Model.GQLTypes.Collaborator> {
  const potentialCollaboratorsQuery = useQuery(POTENTIAL_COLLABORATORS)
  return potentialCollaboratorsQuery.data?.potentialCollaborators || NO_COLLABORATORS
}

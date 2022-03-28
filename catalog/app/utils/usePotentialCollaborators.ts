import useQuery from './useQuery'
import POTENTIAL_COLLABORATORS from './PotentialCollaborators.generated'

export default function usePotentialCollaborators(): number {
  const potentialCollaboratorsQuery = useQuery({
    query: POTENTIAL_COLLABORATORS,
  })
  return potentialCollaboratorsQuery.data?.potentialCollaborators || 0
}

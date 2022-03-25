import useQuery from './useQuery'
import HAS_UNMANAGED_ROLE from './HasUnmanagedRole.generated'

export default function useHasUnmanagedRole(): boolean {
  const hasUnmanagedRolesQuery = useQuery({
    query: HAS_UNMANAGED_ROLE,
  })
  return !!hasUnmanagedRolesQuery.data?.hasUnmanagedRoles
}

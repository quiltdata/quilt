import useQuery from './useQuery'
import HAS_UNMANAGED_ROLE from './HasUnmanagedRole.generated'

export default function useHasUnmanagedRole(): boolean {
  const hasUnmanagedRoleQuery = useQuery({
    query: HAS_UNMANAGED_ROLE,
  })
  return !!hasUnmanagedRoleQuery.data?.hasUnmanagedRole
}

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

type SortKey = 'email' | 'username' | 'permissionLevel'
type Sort = Record<SortKey, boolean> // TODO: only one key at a time is allowed

function getSortProperty(key: SortKey) {
  switch (key) {
    case 'email':
      return R.pathOr('', ['collaborator', 'email'])
    case 'username':
      return R.pathOr('', ['collaborator', 'username'])
    case 'permissionLevel':
      return R.prop('permissionLevel')
  }
}

interface TableProps {
  collaborators: Model.Collaborators
}

export default function Table({ collaborators }: TableProps) {
  const [sorted, setSorted] = React.useState(collaborators)
  const [sort, setSort] = React.useState<Sort | null>(null)
  const toggleSort = React.useCallback(
    (key: SortKey, currentDirection?: boolean) => {
      const direction = currentDirection === undefined ? false : !currentDirection
      setSort({ [key]: direction } as Sort)

      const preSorted = R.sortBy(getSortProperty(key))(collaborators)
      setSorted(direction ? preSorted.reverse() : preSorted)
    },
    [collaborators, setSort, setSorted],
  )
  const hasUnmanagedRole = React.useMemo(
    () => collaborators.find(({ permissionLevel }) => !permissionLevel),
    [collaborators],
  )

  return (
    <M.Table size={collaborators.length > 20 ? 'small' : 'medium'}>
      <M.TableHead>
        <M.TableRow>
          <M.TableCell />
          <M.TableCell>
            <M.TableSortLabel
              active={sort?.username !== undefined}
              direction={sort?.username ? 'asc' : 'desc'}
              onClick={() => toggleSort('username', sort?.username)}
            >
              Username
            </M.TableSortLabel>
          </M.TableCell>
          <M.TableCell>
            <M.TableSortLabel
              active={sort?.email !== undefined}
              direction={sort?.email ? 'asc' : 'desc'}
              onClick={() => toggleSort('email', sort?.email)}
            >
              Email
            </M.TableSortLabel>
          </M.TableCell>
          <M.TableCell>
            <M.TableSortLabel
              active={sort?.permissionLevel !== undefined}
              direction={sort?.permissionLevel ? 'asc' : 'desc'}
              onClick={() => toggleSort('permissionLevel', sort?.permissionLevel)}
            >
              Permission
            </M.TableSortLabel>
          </M.TableCell>
        </M.TableRow>
      </M.TableHead>
      <M.TableBody>
        {sorted.map(
          ({ collaborator: { email, username }, permissionLevel = 'UNKNOWN' }) => (
            <M.TableRow>
              <M.TableCell padding="checkbox">
                <M.Icon>account_circle</M.Icon>
              </M.TableCell>
              <M.TableCell>
                {username}
                {permissionLevel === 'UNKNOWN' ? <sup> *</sup> : ''}
              </M.TableCell>
              <M.TableCell>{email}</M.TableCell>
              <M.TableCell>{permissionLevel}</M.TableCell>
            </M.TableRow>
          ),
        )}
        {hasUnmanagedRole && (
          <M.TableRow>
            <M.TableCell />
            <M.TableCell colSpan={3}>
              <sup>*</sup> User with a role not managed by Quilt who can potentially
              access this bucket. Ask a Quilt administrator for details.
            </M.TableCell>
          </M.TableRow>
        )}
      </M.TableBody>
    </M.Table>
  )
}

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

type SortKey = 'email' | 'username' | 'permissionLevel'
type Sort = Record<SortKey, boolean> // TODO: only one key at a time is allowed

function getSortProperty(key: SortKey) {
  switch (key) {
    case 'email':
      return R.view(R.lensPath(['collaborator', 'email']))
    case 'username':
      return R.view(R.lensPath(['collaborator', 'username']))
    case 'permissionLevel':
      return R.prop('permissionLevel')
  }
}

interface CollaboratorsTableProps {
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
}

function CollaboratorsTable({ collaborators }: CollaboratorsTableProps) {
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
        {sorted.map(({ collaborator: { email, username }, permissionLevel }) => (
          <M.TableRow>
            <M.TableCell padding="checkbox">
              <M.Icon>account_circle</M.Icon>
            </M.TableCell>
            <M.TableCell>{username}</M.TableCell>
            <M.TableCell>{email}</M.TableCell>
            <M.TableCell>{permissionLevel}</M.TableCell>
          </M.TableRow>
        ))}
      </M.TableBody>
    </M.Table>
  )
}

interface PopupProps {
  open: boolean
  onClose: () => void
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
}

export function Popup({ open, onClose, collaborators }: PopupProps) {
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <M.DialogContent>
        <CollaboratorsTable collaborators={collaborators} />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

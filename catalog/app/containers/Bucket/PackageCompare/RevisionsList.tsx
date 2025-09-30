import * as dateFns from 'date-fns'
import * as React from 'react'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import type { PackageHandle } from 'utils/packageHandle'

import REVISION_LIST_QUERY from '../PackageRevisions/gql/RevisionList.generated'

type RevisionFields = NonNullable<
  NonNullable<
    ResultOf<typeof REVISION_LIST_QUERY>['package']
  >['revisions']['page'][number]
>

interface RevisionsListProps {
  packageHandle: PackageHandle | null
  onChange: (hash: string) => void
  label?: string
}

const useStyles = M.makeStyles((t) => ({
  select: {
    minWidth: 300,
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

export default function RevisionsList({ packageHandle, onChange }: RevisionsListProps) {
  const classes = useStyles()

  const revisionListQuery = GQL.useQuery(REVISION_LIST_QUERY, {
    bucket: packageHandle?.bucket || '',
    name: packageHandle?.name || '',
    page: 1,
    perPage: 100, // Get enough revisions for the dropdown
    pause: !packageHandle,
  })

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    onChange(event.target.value as string)
  }

  return (
    <M.Select
      value={packageHandle?.hash || ''}
      onChange={handleChange}
      displayEmpty
      disabled={revisionListQuery.fetching}
      fullWidth
    >
      <M.MenuItem value="">
        <em>None</em>
      </M.MenuItem>
      {GQL.fold(revisionListQuery, {
        data: (d) =>
          d.package?.revisions.page.map((r: RevisionFields) => (
            <M.MenuItem key={r.hash} value={r.hash}>
              <M.Box>
                <M.Typography variant="body2">
                  {dateFns.format(r.modified, 'MMM d yyyy - h:mma')}
                </M.Typography>
                <M.Typography variant="caption" color="textSecondary">
                  {r.message || 'No message'}
                </M.Typography>
                <M.Typography
                  variant="caption"
                  className={classes.mono}
                  color="textSecondary"
                  display="block"
                >
                  {r.hash}
                </M.Typography>
              </M.Box>
            </M.MenuItem>
          )) || [],
        error: () => [
          <M.MenuItem key="error" disabled>
            Error loading revisions
          </M.MenuItem>,
        ],
        fetching: () => [
          <M.MenuItem key="loading" disabled>
            Loading revisions...
          </M.MenuItem>,
        ],
      })}
    </M.Select>
  )
}

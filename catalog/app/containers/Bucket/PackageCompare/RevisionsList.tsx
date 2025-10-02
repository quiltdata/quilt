import * as dateFns from 'date-fns'
import * as React from 'react'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'

import REVISION_LIST_QUERY from './gql/RevisionList.generated'

type RevisionFields = NonNullable<
  NonNullable<
    ResultOf<typeof REVISION_LIST_QUERY>['package']
  >['revisions']['page'][number]
>

const useStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
  },
  hash: {
    fontFamily: t.typography.monospace.fontFamily,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

interface RevisionsListProps {
  packageHandle: { bucket: string; name: string }
  value: string
  onChange: (hash: string) => void
  temporaryRemoveNone?: boolean
}

export default function RevisionsList({
  temporaryRemoveNone = false,
  packageHandle,
  onChange,
  value,
}: RevisionsListProps) {
  const classes = useStyles()
  const revisionListQuery = GQL.useQuery(REVISION_LIST_QUERY, {
    bucket: packageHandle.bucket || '',
    name: packageHandle.name || '',
    page: 1,
    perPage: 100, // Get enough revisions for the dropdown
  })

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    onChange(event.target.value as string)
  }

  return (
    <M.Select
      value={value}
      onChange={handleChange}
      displayEmpty
      disabled={revisionListQuery.fetching}
      fullWidth
      className={classes.root}
    >
      {!temporaryRemoveNone && (
        <M.MenuItem value="">
          <em>None</em>
        </M.MenuItem>
      )}
      {GQL.fold(revisionListQuery, {
        data: (d) =>
          d.package?.revisions.page.map((r: RevisionFields) => (
            <M.MenuItem key={r.hash} value={r.hash}>
              <M.ListItemText
                primary={dateFns.format(r.modified, 'MMM d yyyy - h:mma')}
                secondary={
                  <>
                    {r.message || 'No message'}
                    <br />
                    <span className={classes.hash}>{r.hash}</span>
                  </>
                }
              />
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

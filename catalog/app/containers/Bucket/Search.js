import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import * as SearchResults from 'components/SearchResults'
import Working from 'components/Working'
import * as AWS from 'utils/AWS'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'

import Message from './Message'

function Browse({ bucket }) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Button component={Link} to={urls.bucketRoot(bucket)} variant="outlined">
      Browse the bucket
    </M.Button>
  )
}

function Results({ bucket, query, searchEndpoint }) {
  const cfg = Config.useConfig()
  const es = AWS.ES.use({ endpoint: searchEndpoint, sign: cfg.shouldSign(bucket) })
  const scrollRef = React.useRef(null)
  const scroll = React.useCallback((prev) => {
    if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
  })

  const data = Data.use(search, { es, buckets: [bucket], query })

  return data.case({
    _: () => <Working>Searching</Working>,
    Err: () => (
      <Message headline="Server Error">
        Something went wrong.
        <br />
        <br />
        <M.Button onClick={data.fetch} color="primary" variant="contained">
          Retry
        </M.Button>
      </Message>
    ),
    Ok: ({ total, hits }) => (
      <>
        <M.Box mb={2} mt={1}>
          <M.Typography variant="h5">
            {total
              ? `Search results for "${query}" (${total} hits, ${hits.length} files)`
              : `Nothing found for "${query}"`}
          </M.Typography>
        </M.Box>
        <div ref={scrollRef} />
        {total ? (
          <Pagination.Paginate items={hits} onChange={scroll}>
            {({ paginated, ...props }) => (
              <>
                {paginated.map((hit) => (
                  <SearchResults.Hit key={hit.path} bucket={bucket} hit={hit} />
                ))}
                {props.pages > 1 && (
                  <M.Box mt={2}>
                    <Pagination.Controls {...props} />
                  </M.Box>
                )}
              </>
            )}
          </Pagination.Paginate>
        ) : (
          <>
            <M.Typography variant="body1">
              We have not found anything matching your query
            </M.Typography>
            <br />
            <Browse bucket={bucket} />
          </>
        )}
      </>
    ),
  })
}

export default function Search({ location: l }) {
  const { q: query = '' } = parseSearch(l.search)
  const { name, searchEndpoint } = BucketConfig.useCurrentBucketConfig()
  return (
    <M.Box py={2}>
      {searchEndpoint ? (
        <Results {...{ bucket: name, searchEndpoint, query }} />
      ) : (
        <Message headline="Search Not Available">
          This bucket has no configured search endpoint.
        </Message>
      )}
    </M.Box>
  )
}

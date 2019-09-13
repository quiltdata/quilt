import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Message from 'components/Message'
import * as Pagination from 'components/Pagination'
import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'

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
    _: () => (
      <Delay alwaysRender>
        {(ready) => (
          <M.Fade in={ready}>
            <M.Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              px={{ xs: 2, sm: 0 }}
              pt={{ xs: 2, sm: 4 }}
            >
              <M.Box pr={2}>
                <M.CircularProgress size={24} />
              </M.Box>
              <M.Typography variant="body1">
                Searching s3://{bucket} for &quot;{query}&quot;
              </M.Typography>
            </M.Box>
          </M.Fade>
        )}
      </Delay>
    ),
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
        <M.Box pt={{ xs: 2, sm: 3 }} pb={{ xs: 2, sm: 1 }} px={{ xs: 2, sm: 0 }}>
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
                  <SearchResults.Hit key={hit.path} hit={hit} />
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
          <M.Box px={{ xs: 2, sm: 0 }} pt={{ xs: 0, sm: 1 }}>
            <M.Typography variant="body1">
              We have not found anything matching your query
            </M.Typography>
            <br />
            <Browse bucket={bucket} />
          </M.Box>
        )}
      </>
    ),
  })
}

export default function Search({ location: l }) {
  const { q: query = '' } = parseSearch(l.search)
  const { name, searchEndpoint } = BucketConfig.useCurrentBucketConfig()
  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
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

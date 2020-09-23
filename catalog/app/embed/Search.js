import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'

function Results({ bucket, query, page, makePageUrl, scrollRef }) {
  const req = AWS.APIGateway.use()
  const data = Data.use(search, { req, buckets: [bucket], mode: 'objects', query })
  return data.case({
    _: () => (
      <SearchResults.Progress>
        Searching s3://{bucket} for &quot;{query}&quot;
      </SearchResults.Progress>
    ),
    Err: SearchResults.handleErr(data.fetch),
    Ok: ({ total, hits }) =>
      total ? (
        <SearchResults.Hits {...{ hits, page, scrollRef, makePageUrl }} />
      ) : (
        <SearchResults.NothingFound />
      ),
  })
}

export default function Search({
  match: {
    params: { bucket },
  },
  location: l,
}) {
  const { urls } = NamedRoutes.use()
  const { q: query = '', p } = parseSearch(l.search)
  const page = p && parseInt(p, 10)
  const makePageUrl = React.useCallback(
    (newP) => urls.bucketSearch(bucket, query, newP !== 1 ? newP : undefined),
    [urls, bucket, query],
  )
  const scrollRef = React.useRef(null)
  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      <M.Box position="relative" top={-80} ref={scrollRef} />
      <Results {...{ bucket, query, page, makePageUrl, scrollRef }} />
    </M.Box>
  )
}

import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Message from 'components/Message'
import Pagination from 'components/Pagination2'
import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as BucketConfig from 'utils/BucketConfig'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'
import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10

function Browse({ bucket }) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Button component={Link} to={urls.bucketRoot(bucket)} variant="outlined">
      Browse the bucket
    </M.Button>
  )
}

function Hits({ hits, page, scrollRef, makePageUrl }) {
  const actualPage = page || 1
  const pages = Math.ceil(hits.length / PER_PAGE)

  const paginated = React.useMemo(
    () =>
      pages === 1 ? hits : hits.slice((actualPage - 1) * PER_PAGE, actualPage * PER_PAGE),
    [hits, actualPage],
  )

  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  return (
    <>
      {paginated.map((hit) => (
        <SearchResults.Hit key={hit.path} hit={hit} showBucket />
      ))}
      {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
    </>
  )
}

function Results({ bucket, query, page, makePageUrl }) {
  const es = AWS.ES.use()
  const scrollRef = React.useRef(null)
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
          <Hits {...{ hits, page, scrollRef, makePageUrl }} />
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

export default function Search({
  match: {
    params: { bucket },
  },
  location: l,
}) {
  const cfg = BucketConfig.useCurrentBucketConfig()
  const { urls } = NamedRoutes.use()
  const { q: query = '', p } = parseSearch(l.search)
  const page = p && parseInt(p, 10)
  const makePageUrl = React.useCallback(
    (newP) => urls.bucketSearch(bucket, query, newP !== 1 ? newP : undefined),
    [urls, bucket, query],
  )
  return (
    <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
      {cfg ? (
        <Results {...{ bucket, query, page, makePageUrl }} />
      ) : (
        <M.Typography variant="body1">Search unavailable</M.Typography>
      )}
    </M.Box>
  )
}

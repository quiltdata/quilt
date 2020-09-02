import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Message from 'components/Message'
import Pagination from 'components/Pagination2'
import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'
import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10

function Alt({ ...props }) {
  return (
    <M.Box
      borderTop={{ xs: 1, sm: 0 }}
      borderColor="divider"
      pt={3}
      px={{ xs: 2, sm: 0 }}
      {...props}
    />
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
        <SearchResults.Hit key={hit.key} hit={hit} />
      ))}
      {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
    </>
  )
}

function Results({ bucket, query, page, makePageUrl, scrollRef }) {
  const req = AWS.APIGateway.use()
  const data = Data.use(search, { req, buckets: [bucket], mode: 'objects', query })
  return data.case({
    _: () => (
      <Alt>
        <Delay alwaysRender>
          {(ready) => (
            <M.Fade in={ready}>
              <M.Box display="flex" alignItems="center">
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
      </Alt>
    ),
    Err: R.cond([
      [
        R.propEq('message', 'TooManyRequests'),
        () => (
          <Alt>
            <Message headline="Too many requests">
              Processing a lot of requests. Please try your search again in a few minutes.
              <br />
              <br />
              <M.Button onClick={data.fetch} color="primary" variant="contained">
                Retry
              </M.Button>
            </Message>
          </Alt>
        ),
      ],
      [
        R.T,
        () => (
          <Alt>
            <Message headline="Server Error">
              Something went wrong.
              <br />
              <br />
              <M.Button onClick={data.fetch} color="primary" variant="contained">
                Retry
              </M.Button>
            </Message>
          </Alt>
        ),
      ],
    ]),
    Ok: ({ total, hits }) =>
      total ? (
        <Hits {...{ hits, page, scrollRef, makePageUrl }} />
      ) : (
        <Alt>
          <M.Typography variant="body1">
            We have not found anything matching your query
          </M.Typography>
        </Alt>
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

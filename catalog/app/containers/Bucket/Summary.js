import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import * as Preview from 'components/Preview'
import Thumbnail, { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { getBasename, getPrefix, withoutPrefix } from 'utils/s3paths'

import * as requests from './requests'

const README_RE = /^readme\.md$/i
const SUMMARIZE_RE = /^quilt_summarize\.json$/i

const withSignedUrl = (handle, callback) => (
  <AWS.Signer.Inject>
    {(signer) => callback(signer.getSignedS3URL(handle))}
  </AWS.Signer.Inject>
)

const findFile = (re) => R.find((f) => re.test(getBasename(f.logicalKey || f.key)))

const extractSummary = R.applySpec({
  readme: findFile(README_RE),
  summarize: findFile(SUMMARIZE_RE),
  images: R.filter((f) =>
    SUPPORTED_EXTENSIONS.some((ext) =>
      (f.logicalKey || f.key).toLowerCase().endsWith(ext),
    ),
  ),
})

const Container = M.styled(M.Card)(({ theme: t }) => ({
  marginTop: t.spacing(2),
}))

const Header = ({ children }) => (
  <M.CardHeader title={<M.Typography variant="h5">{children}</M.Typography>} />
)

function HandleResolver({ resolve, handle, children }) {
  if (resolve && handle.logicalKey && !handle.key) {
    return (
      <Data fetch={resolve} params={handle.logicalKey}>
        {children}
      </Data>
    )
  }
  return children(AsyncResult.Ok(handle))
}

function SummaryItemFile({ handle, name, mkUrl, resolveLogicalKey }) {
  const renderErr = (_, { fetch }) => (
    <>
      <M.Typography variant="body1" gutterBottom>
        Error loading preview
      </M.Typography>
      <M.Button variant="outlined" onClick={fetch}>
        Retry
      </M.Button>
    </>
  )

  return (
    <Container>
      <Header>
        <StyledLink to={mkUrl(handle)}>
          {name || basename(handle.logicalKey || handle.key)}
        </StyledLink>
      </Header>
      <M.CardContent>
        <HandleResolver resolve={resolveLogicalKey} handle={handle}>
          {AsyncResult.case({
            Err: renderErr,
            _: () => <M.CircularProgress />,
            Ok: (resolved) =>
              Preview.load(
                resolved,
                AsyncResult.case({
                  Ok: AsyncResult.case({
                    Init: (_, { fetch }) => (
                      <>
                        <M.Typography variant="body1" gutterBottom>
                          Large files are not previewed automatically
                        </M.Typography>
                        <M.Button variant="outlined" onClick={fetch}>
                          Load preview
                        </M.Button>
                      </>
                    ),
                    Pending: () => <M.CircularProgress />,
                    Err: renderErr,
                    Ok: (data) => <M.Box mx="auto">{Preview.render(data)}</M.Box>,
                  }),
                  Err: Preview.PreviewError.case({
                    TooLarge: () => (
                      <>
                        <M.Typography variant="body1" gutterBottom>
                          Object is too large to preview in browser
                        </M.Typography>
                        {withSignedUrl(resolved, (url) => (
                          <M.Button variant="outlined" href={url}>
                            View in Browser
                          </M.Button>
                        ))}
                      </>
                    ),
                    Unsupported: () => (
                      <>
                        <M.Typography variant="body1" gutterBottom>
                          Preview not available
                        </M.Typography>
                        {withSignedUrl(resolved, (url) => (
                          <M.Button variant="outlined" href={url}>
                            View in Browser
                          </M.Button>
                        ))}
                      </>
                    ),
                    DoesNotExist: () => (
                      <M.Typography variant="body1">Object does not exist</M.Typography>
                    ),
                    MalformedJson: ({ originalError: { message } }) => (
                      <M.Typography variant="body1" gutterBottom>
                        Malformed JSON: {message}
                      </M.Typography>
                    ),
                    Unexpected: renderErr,
                  }),
                  _: () => <M.CircularProgress />,
                }),
              ),
          })}
        </HandleResolver>
      </M.CardContent>
    </Container>
  )
}

const useThumbnailsStyles = M.makeStyles((t) => ({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  link: {
    flexBasis: '19%',
    marginBottom: t.spacing(2),
  },
  img: {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: '100%',
  },
  filler: {
    flexBasis: '19%',

    '&::after': {
      content: '""',
    },
  },
}))

function Thumbnails({ images, mkUrl, resolveLogicalKey }) {
  const classes = useThumbnailsStyles()

  const scrollRef = React.useRef(null)
  const scroll = React.useCallback((prev) => {
    if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
  })

  const pagination = Pagination.use(images, { perPage: 25, onChange: scroll })

  return (
    <Container>
      <Header>
        Images ({pagination.from}&ndash;{pagination.to} of {images.length})
      </Header>
      <div ref={scrollRef} />
      <M.CardContent className={classes.container}>
        {pagination.paginated.map((i) => (
          <Link key={i.logicalKey || i.key} to={mkUrl(i)} className={classes.link}>
            <HandleResolver resolve={resolveLogicalKey} handle={i}>
              {AsyncResult.case({
                _: () => null,
                Ok: (resolved) => (
                  <Thumbnail
                    handle={resolved}
                    className={classes.img}
                    alt={basename(i.logicalKey || i.key)}
                    title={basename(i.logicalKey || i.key)}
                  />
                ),
              })}
            </HandleResolver>
          </Link>
        ))}
        {R.times(
          (i) => (
            <div className={classes.filler} key={`__filler${i}`} />
          ),
          (5 - (pagination.paginated.length % 5)) % 5,
        )}
      </M.CardContent>
      {pagination.pages > 1 && (
        <M.Box>
          <M.Divider />
          <M.Box display="flex" justifyContent="flex-end" px={2} py={0.25}>
            <Pagination.Controls {...pagination} />
          </M.Box>
        </M.Box>
      )}
    </Container>
  )
}

const useStyles = M.makeStyles((t) => ({
  progress: {
    marginTop: t.spacing(2),
  },
}))

// files: Array of s3 handles
export default function BucketSummary({
  files,
  whenEmpty = () => null,
  mkUrl: mkUrlProp,
  resolveLogicalKey,
}) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const mkUrl = React.useCallback(
    (handle) =>
      mkUrlProp
        ? mkUrlProp(handle)
        : urls.bucketFile(handle.bucket, handle.key, handle.version),
    [mkUrlProp, urls.bucketFile],
  )
  const { readme, images, summarize } = extractSummary(files)

  return (
    <>
      {!readme && !summarize && !images.length && whenEmpty()}
      {readme && (
        <SummaryItemFile
          title={basename(readme.logicalKey || readme.key)}
          handle={readme}
          mkUrl={mkUrl}
          resolveLogicalKey={resolveLogicalKey}
        />
      )}
      {!!images.length && <Thumbnails {...{ images, mkUrl, resolveLogicalKey }} />}
      {summarize && (
        <AWS.S3.Inject>
          {(s3) => (
            <Data
              fetch={requests.summarize}
              params={{ s3, handle: summarize, resolveLogicalKey }}
            >
              {AsyncResult.case({
                Err: (e) => {
                  console.warn('Error loading summary')
                  console.error(e)
                  return null
                },
                _: () => <M.CircularProgress className={classes.progress} />,
                Ok: R.map((i) => (
                  <SummaryItemFile
                    key={i.key}
                    // TODO: make a reusable function to compute relative s3 paths or smth
                    title={withoutPrefix(
                      getPrefix(summarize.logicalKey || summarize.key),
                      i.logicalKey || i.key,
                    )}
                    handle={i}
                    mkUrl={mkUrl}
                  />
                )),
              })}
            </Data>
          )}
        </AWS.S3.Inject>
      )}
    </>
  )
}

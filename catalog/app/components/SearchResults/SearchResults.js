import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import { copyWithoutSpaces } from 'components/BreadCrumbs'
import JsonDisplay from 'components/JsonDisplay'
import Pagination from 'components/Pagination2'
import * as Preview from 'components/Preview'
import { Section, Heading } from 'components/ResponsiveSection'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useBucketExistence } from 'utils/BucketCache'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink, { linkStyle } from 'utils/StyledLink'
import { getBreadCrumbs } from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import usePrevious from 'utils/usePrevious'

import * as requests from 'containers/Bucket/requests'

const PER_PAGE = 10
const ES_V = '6.8'
const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}`
const ES_REF_SYNTAX = `${ES_REF}/query-dsl-query-string-query.html#query-string-syntax`
const ES_REF_WILDCARDS = `${ES_REF}/query-dsl-query-string-query.html#_wildcards`

const CrumbLink = M.styled(StyledLink)({ wordBreak: 'break-word' })

function ObjectCrumbs({ handle, showBucket = false }) {
  const { urls } = NamedRoutes.use()
  const isDir = handle.key.endsWith('/')

  const crumbs = React.useMemo(() => {
    const all = getBreadCrumbs(handle.key)
    const dirs = R.init(all).map(({ label, path }) => ({
      to: urls.bucketFile(handle.bucket, path),
      children: label,
    }))
    const file = {
      to: urls.bucketFile(handle.bucket, handle.key, handle.version),
      children: R.last(all).label,
    }
    const bucket = showBucket
      ? {
          to: urls.bucketRoot(handle.bucket),
          children: handle.bucket,
        }
      : null
    return { bucket, dirs, file }
  }, [handle, urls, showBucket])

  return (
    <span onCopy={copyWithoutSpaces}>
      <HeaderIcon title={isDir ? 'Directory' : 'File'}>
        {isDir ? 'folder_open' : 'insert_drive_file'}
      </HeaderIcon>
      {crumbs.bucket && (
        <>
          <CrumbLink {...crumbs.bucket} />
          &nbsp;/{' '}
        </>
      )}
      {crumbs.dirs.map((c) => (
        <React.Fragment key={`crumb:${c.to}`}>
          <CrumbLink {...c} />
          &nbsp;/{' '}
        </React.Fragment>
      ))}
      <CrumbLink {...crumbs.file} />
    </span>
  )
}

function HeaderIcon(props) {
  return (
    <M.Box
      component={M.Icon}
      color="text.hint"
      mr={1}
      style={{ verticalAlign: 'middle' }}
      {...props}
    />
  )
}

function ObjectHeader({ handle, showBucket, downloadable = false }) {
  return (
    <Heading display="flex" alignItems="center" mb="0 !important">
      <ObjectCrumbs {...{ handle, showBucket }} />
      <M.Box flexGrow={1} />
      {!!downloadable &&
        AWS.Signer.withDownloadUrl(handle, (url) => (
          <M.Box
            alignItems="center"
            display="flex"
            height={32}
            justifyContent="center"
            width={24}
            my={{ xs: -0.25, md: 0 }}
          >
            <M.IconButton href={url} title="Download" download>
              <M.Icon>arrow_downward</M.Icon>
            </M.IconButton>
          </M.Box>
        ))}
    </Heading>
  )
}

function PackageHeader({ bucket, handle, hash, showBucket }) {
  const { urls } = NamedRoutes.use()
  return (
    <Heading mb={1}>
      <HeaderIcon title="Package" component={M.SvgIcon} viewBox="-133 0 1264 1008">
        <path
          fill="currentColor"
          d="M-2 918V446l1004 4v472c0 52-41 93-92 93H91c-52 0-93-43-93-97zM193 3h278v380H0c0-6 0-12 2-16L102 68c14-40 50-65 91-65zm709 63l100 299v2c2 4 2 8 2 12H534V1h277c41 0 77 25 91 65z"
        />
      </HeaderIcon>
      <span>
        {!!showBucket && (
          <>
            <CrumbLink to={urls.bucketPackageList(bucket)}>{bucket}</CrumbLink>
            &nbsp;/{' '}
          </>
        )}
        <CrumbLink to={urls.bucketPackageTree(bucket, handle, hash)}>
          {handle}
          <M.Box component="span" color="text.hint">
            @
          </M.Box>
          {R.take(10, hash)}
        </CrumbLink>
      </span>
      <M.Box flexGrow={1} />
    </Heading>
  )
}

const SmallerSection = ({ children }) => <M.Box mt={2}>{children}</M.Box>

const SectionHeading = ({ children, ...props }) => (
  <M.Typography variant="h6" {...props}>
    {children}
  </M.Typography>
)

const Bold = ({ ...props }) => (
  <M.Box
    color="text.primary"
    fontWeight="fontWeightRegular"
    component="span"
    {...props}
  />
)

const Nowrap = M.styled('span')({ whiteSpace: 'nowrap' })

const useVersionInfoStyles = M.makeStyles((t) => ({
  versionContainer: {
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightLight,
  },
  version: {
    fontFamily: t.typography.monospace.fontFamily,
    fontWeight: t.typography.fontWeightMedium,
  },
  seeOther: {
    borderBottom: '1px dashed',
    cursor: 'pointer',
    ...linkStyle,
  },
}))

function VersionInfo({ bucket, path, version, versions }) {
  const classes = useVersionInfoStyles()
  const { urls } = NamedRoutes.use()
  const [versionsShown, setVersionsShown] = React.useState(false)
  const toggleVersions = React.useCallback(() => {
    setVersionsShown(!versionsShown)
  }, [setVersionsShown, versionsShown])

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const clip = (str, len) => {
    const s = `${str}`
    return xs ? s.substring(0, len) : s
  }

  return (
    <M.Box mt={1}>
      <M.Typography variant="subtitle1" className={classes.versionContainer}>
        <Nowrap>
          Version{' '}
          <StyledLink
            to={urls.bucketFile(bucket, path, version.id)}
            className={classes.version}
          >
            {clip(version.id, 24)}
          </StyledLink>
        </Nowrap>{' '}
        <Nowrap>
          from <Bold>{version.updated.toLocaleString()}</Bold>
          {' | '}
          <Bold>{readableBytes(version.size)}</Bold>
        </Nowrap>
      </M.Typography>
      {versions.length > 1 && (
        <M.Typography>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <span className={classes.seeOther} onClick={toggleVersions}>
            {versionsShown ? 'hide ' : 'show '} all versions ({versions.length})
          </span>
        </M.Typography>
      )}
      {versions.length > 1 && versionsShown && (
        <SmallerSection>
          <SectionHeading gutterBottom>Versions ordered by relevance</SectionHeading>
          {versions.map((v) => (
            <M.Typography
              key={`${v.updated.getTime()}:${v.id}`}
              variant="body2"
              className={classes.versionContainer}
            >
              <StyledLink
                to={urls.bucketFile(bucket, path, v.id)}
                className={classes.version}
              >
                {clip(v.id, 6)}
              </StyledLink>
              {' from '}
              <Bold>{v.updated.toLocaleString()}</Bold>
              {' | '}
              {v.deleteMarker ? (
                <Bold>Delete Marker</Bold>
              ) : (
                <Bold>{readableBytes(v.size)}</Bold>
              )}
            </M.Typography>
          ))}
        </SmallerSection>
      )}
    </M.Box>
  )
}

const usePreviewBoxStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.grey[300]}`,
    borderRadius: t.shape.borderRadius,
    maxHeight: t.spacing(30),
    marginTop: t.spacing(1),
    minHeight: t.spacing(15),
    padding: t.spacing(2),
    position: 'relative',

    '& img': {
      marginLeft: 'auto',
      marginRight: 'auto',
    },

    // workarounds to speed-up notebook preview rendering:
    '&:not($expanded)': {
      // hide overflow only when not expanded, using this while expanded
      // slows down the page in chrome
      overflow: 'hidden',

      // only show 2 first cells unless expanded
      '& .ipynb-preview .cell:nth-child(n+3)': {
        display: 'none',
      },
    },
  },
  expanded: {
    maxHeight: 'none',
  },
  fade: {
    alignItems: 'flex-end',
    background: `linear-gradient(to top,
      rgba(255, 255, 255, 1),
      rgba(255, 255, 255, 0.9),
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.1)
    )`,
    bottom: 0,
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    left: 0,
    padding: t.spacing(1),
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
}))

function PreviewBox({ children, title }) {
  const classes = usePreviewBoxStyles()
  const [expanded, setExpanded] = React.useState(false)
  const expand = React.useCallback(() => {
    setExpanded(true)
  }, [setExpanded])
  return (
    <SmallerSection>
      {title && <SectionHeading>{title}</SectionHeading>}

      <div className={cx(classes.root, { [classes.expanded]: expanded })}>
        {children}

        {!expanded && (
          <div className={classes.fade}>
            <M.Button variant="outlined" onClick={expand}>
              Expand
            </M.Button>
          </div>
        )}
      </div>
    </SmallerSection>
  )
}

const renderContents = (children) => <PreviewBox {...{ children }} />

function PreviewDisplay({ handle, bucketExistenceData, versionExistenceData }) {
  const withData = (callback) =>
    bucketExistenceData.case({
      _: callback,
      Err: () => callback(AsyncResult.Err(Preview.PreviewError.DoesNotExist({ handle }))),
      Ok: () =>
        versionExistenceData.case({
          _: callback,
          Err: (e) =>
            callback(
              AsyncResult.Err(
                Preview.PreviewError.Unexpected({ handle, originalError: e }),
              ),
            ),
          Ok: requests.ObjectExistence.case({
            Exists: (h) => {
              if (h.deleted) {
                return callback(AsyncResult.Err(Preview.PreviewError.Deleted({ handle })))
              }
              if (h.archived) {
                return callback(
                  AsyncResult.Err(Preview.PreviewError.Archived({ handle })),
                )
              }
              return Preview.load(handle, callback)
            },
            DoesNotExist: () =>
              callback(AsyncResult.Err(Preview.PreviewError.InvalidVersion({ handle }))),
          }),
        }),
    })

  return withData(Preview.display({ renderContents, renderProgress: Progress }))
}

function Meta({ meta }) {
  if (!meta || R.isEmpty(meta)) return null

  return (
    <PreviewBox title="Metadata">
      <JsonDisplay defaultExpanded={1} value={meta} />
    </PreviewBox>
  )
}

const useRevisionInfoStyles = M.makeStyles((t) => ({
  revision: {
    ...t.typography.subtitle1,
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightLight,
    marginTop: t.spacing(2),
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
    fontWeight: t.typography.fontWeightMedium,
  },
  msg: {
    ...t.typography.body2,
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    display: '-webkit-box',
    marginTop: t.spacing(1),
    overflow: 'hidden',
    overflowWrap: 'break-word',
    textOverflow: 'ellipsis',
  },
}))

function RevisionInfo({ bucket, handle, hash, comment, lastModified }) {
  const classes = useRevisionInfoStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Box>
      <p className={classes.revision}>
        <Nowrap>
          Revision{' '}
          <StyledLink
            to={urls.bucketPackageTree(bucket, handle, hash)}
            className={classes.mono}
            title={hash}
          >
            {R.take(10, hash)}
          </StyledLink>
        </Nowrap>{' '}
        <Nowrap>
          from <Bold>{lastModified.toLocaleString()}</Bold>
        </Nowrap>
      </p>
      <p className={classes.msg}>{comment || <i>No message</i>}</p>
    </M.Box>
  )
}

function ObjectHit({ hit, ...props }) {
  const Component = hit.path.endsWith('/') ? DirHit : FileHit
  return <Component {...{ hit, ...props }} />
}

function FileHit({ showBucket, hit: { path, versions, bucket } }) {
  const cfg = Config.use()
  const s3 = AWS.S3.use()

  const v = versions[0]
  const handle = { bucket, key: path, version: v.id }

  const bucketExistenceData = useBucketExistence(bucket)
  const versionExistenceData = Data.use(requests.getObjectExistence, { s3, ...handle })

  const downloadable =
    !cfg.noDownload &&
    bucketExistenceData.case({
      _: () => false,
      Ok: () =>
        versionExistenceData.case({
          _: () => false,
          Ok: requests.ObjectExistence.case({
            _: () => false,
            Exists: ({ deleted, archived }) => !deleted && !archived,
          }),
        }),
    })

  return (
    <Section>
      <ObjectHeader {...{ handle, showBucket, downloadable }} />
      <VersionInfo bucket={bucket} path={path} version={v} versions={versions} />
      <Meta meta={v.meta} />
      <PreviewDisplay {...{ handle, bucketExistenceData, versionExistenceData }} />
    </Section>
  )
}

function DirHit({
  showBucket,
  hit: {
    path,
    versions: [v],
    bucket,
  },
}) {
  const handle = { bucket, key: path }
  return (
    <Section>
      <ObjectHeader {...{ handle, showBucket }} />
      <Meta meta={v.meta} />
    </Section>
  )
}

function PackageHit({
  showBucket,
  hit: { bucket, handle, hash, lastModified, meta, tags, comment },
}) {
  return (
    <Section>
      <PackageHeader {...{ handle, bucket, hash, showBucket }} />
      <RevisionInfo {...{ bucket, handle, hash, comment, lastModified }} />
      {tags && tags.length > 0 && (
        <M.Box mt={2}>
          {tags.map((t) => (
            <React.Fragment key={t}>
              <M.Chip variant="outlined" size="small" label={t} />{' '}
            </React.Fragment>
          ))}
        </M.Box>
      )}
      <Meta meta={meta} />
    </Section>
  )
}

export function Hit(props) {
  const Component = props.hit.type === 'package' ? PackageHit : ObjectHit
  return <Component {...props} />
}

export function Hits({
  hits,
  page,
  scrollRef,
  makePageUrl,
  perPage = PER_PAGE,
  showBucket,
}) {
  const actualPage = page || 1
  const pages = Math.ceil(hits.length / perPage)

  const paginated = React.useMemo(
    () =>
      pages === 1 ? hits : hits.slice((actualPage - 1) * perPage, actualPage * perPage),
    [hits, actualPage, perPage, pages],
  )

  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  return (
    <>
      {paginated.map((hit) => (
        <Hit key={hit.key} hit={hit} showBucket={showBucket} />
      ))}
      {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
    </>
  )
}

const useAltStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(3),
    [t.breakpoints.down('xs')]: {
      borderTop: `1px solid ${t.palette.divider}`,
      paddingLeft: t.spacing(2),
      paddingRight: t.spacing(2),
    },
  },
}))

export function Alt({ className, ...props }) {
  const classes = useAltStyles()
  return <M.Box className={cx(className, classes.root)} {...props} />
}

export function Progress({ children }) {
  return (
    <Alt>
      <Delay alwaysRender>
        {(ready) => (
          <M.Fade in={ready}>
            <M.Box display="flex" alignItems="center">
              <M.Box pr={2}>
                <M.CircularProgress size={24} />
              </M.Box>
              <M.Typography variant="body1">{children}</M.Typography>
            </M.Box>
          </M.Fade>
        )}
      </Delay>
    </Alt>
  )
}

export const handleErr = (retryUrl) => (e) =>
  (
    <Alt>
      <M.Typography variant="h5" gutterBottom>
        {e.message === 'SearchSyntaxError' ? ( // eslint-disable-line no-nested-ternary
          <>Search syntax error</>
        ) : e.message === 'Timeout' ? (
          <>Query timed out</>
        ) : (
          <>Search error</>
        )}
      </M.Typography>
      {e.message === 'SearchSyntaxError' ? ( // eslint-disable-line no-nested-ternary
        <M.Typography gutterBottom>
          Oops, couldn&apos;t parse that search. Try quoting your query or read about{' '}
          <StyledLink href={ES_REF_SYNTAX} target="_blank">
            supported query syntax
          </StyledLink>
          .
          {!!retryUrl && (
            <> You can also click RETRY to try a simplified version of your query.</>
          )}
        </M.Typography>
      ) : e.message === 'Timeout' ? (
        <M.Typography gutterBottom>
          That made ElasticSearch sweat. Try{' '}
          <StyledLink href={ES_REF_WILDCARDS} target="_blank">
            avoiding wildcards
          </StyledLink>{' '}
          or ask Quilt about scaling your cluster.
        </M.Typography>
      ) : (
        <M.Typography gutterBottom>
          ElasticSearch had trouble with that query. The cluster may be busy indexing new
          documents. Try again later
          {!!retryUrl && <> or click RETRY to try a simplified version of your query</>}.
        </M.Typography>
      )}
      {!!e.status && <M.Typography>Status: {e.status}</M.Typography>}
      {!!e.code && <M.Typography>Code: {e.code}</M.Typography>}
      {!!e.details && (
        <>
          <M.Typography>Error details:</M.Typography>
          <M.Typography style={{ whiteSpace: 'pre' }}>{e.details}</M.Typography>
        </>
      )}
      {!!retryUrl && (
        <M.Box pt={2}>
          <M.Button component={Link} to={retryUrl} color="primary" variant="contained">
            Retry simplified query
          </M.Button>
        </M.Box>
      )}
    </Alt>
  )

export function NothingFound({ children }) {
  return (
    <Alt>
      <M.Typography variant="body1">
        We have not found anything matching your query
      </M.Typography>
      {children}
    </Alt>
  )
}

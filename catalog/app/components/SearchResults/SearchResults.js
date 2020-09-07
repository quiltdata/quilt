import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { copyWithoutSpaces } from 'components/BreadCrumbs'
import Message from 'components/Message'
import Pagination from 'components/Pagination2'
import * as Preview from 'components/Preview'
import { Section, Heading } from 'components/ResponsiveSection'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useBucketExistence } from 'utils/BucketCache'
import * as Config from 'utils/Config'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink, { linkStyle } from 'utils/StyledLink'
import { getBreadCrumbs } from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10
const ES_V = '6.7'
const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/query-dsl-query-string-query.html#query-string-syntax`

const CrumbLink = M.styled(StyledLink)({ wordBreak: 'break-word' })

function ObjectCrumbs({ handle, showBucket = false }) {
  const { urls } = NamedRoutes.use()

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
      <HeaderIcon title="File">insert_drive_file</HeaderIcon>
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

function ObjectHeader({ handle, showBucket, bucketExistenceData }) {
  const cfg = Config.use()
  return (
    <Heading display="flex" alignItems="center" mb={1}>
      <ObjectCrumbs {...{ handle, showBucket }} />
      <M.Box flexGrow={1} />
      {!cfg.noDownload &&
        bucketExistenceData.case({
          _: () => null,
          Ok: () =>
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
            )),
        })}
    </Heading>
  )
}

function PackageHeader({ bucket, handle, revision, showBucket }) {
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
        <CrumbLink to={urls.bucketPackageTree(bucket, handle, revision)}>
          {handle}
          {revision !== 'latest' && (
            <>
              <M.Box component="span" color="text.hint">
                @
              </M.Box>
              {revision}
            </>
          )}
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
  const clip = (str, len) => (xs ? str.substring(0, len) : str)

  return (
    <>
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
              <Bold>{readableBytes(v.size)}</Bold>
            </M.Typography>
          ))}
        </SmallerSection>
      )}
    </>
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

function PreviewBox({ data }) {
  const classes = usePreviewBoxStyles()
  const [expanded, setExpanded] = React.useState(false)
  const expand = React.useCallback(() => {
    setExpanded(true)
  }, [setExpanded])
  return (
    <div className={cx(classes.root, { [classes.expanded]: expanded })}>
      {Preview.render(data)}
      {!expanded && (
        <div className={classes.fade}>
          <M.Button variant="outlined" onClick={expand}>
            Expand
          </M.Button>
        </div>
      )}
    </div>
  )
}

function PreviewDisplay({ handle, bucketExistenceData }) {
  if (!handle.version) return null
  return (
    <SmallerSection>
      <SectionHeading>Preview</SectionHeading>
      {bucketExistenceData.case({
        _: () => <M.CircularProgress />,
        Err: () => (
          <M.Typography variant="body1">
            Error loading preview: bucket does not exist
          </M.Typography>
        ),
        Ok: () =>
          Preview.load(
            handle,
            AsyncResult.case({
              Ok: AsyncResult.case({
                Init: (_, { fetch }) => (
                  <M.Typography variant="body1">
                    Large files are not previewed by default{' '}
                    <M.Button variant="outlined" size="small" onClick={fetch}>
                      Load preview
                    </M.Button>
                  </M.Typography>
                ),
                Pending: () => <M.CircularProgress />,
                Err: (_, { fetch }) => (
                  <M.Typography variant="body1">
                    Error loading preview{' '}
                    <M.Button variant="outlined" size="small" onClick={fetch}>
                      Retry
                    </M.Button>
                  </M.Typography>
                ),
                Ok: (data) => <PreviewBox data={data} />,
              }),
              Err: () => (
                <M.Typography variant="body1">Preview not available</M.Typography>
              ),
              _: () => <M.CircularProgress />,
            }),
          ),
      })}
    </SmallerSection>
  )
}

function Meta({ meta }) {
  if (!meta || R.isEmpty(meta)) return null
  return (
    <SmallerSection>
      <SectionHeading>Metadata</SectionHeading>
      <M.Box
        component="pre"
        bgcolor={M.colors.lightBlue[50]}
        borderColor={M.colors.lightBlue[400]}
        borderRadius="borderRadius"
        p={1}
        mb={0}
        mt={1}
        style={{ opacity: 0.7 }}
      >
        {JSON.stringify(meta, null, 2)}
      </M.Box>
    </SmallerSection>
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
  hash: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    fontFamily: t.typography.monospace.fontFamily,
    marginTop: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

function RevisionInfo({ bucket, handle, revision, hash, comment, lastModified }) {
  const classes = useRevisionInfoStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Box>
      <p className={classes.revision}>
        <Nowrap>
          Revision{' '}
          <StyledLink
            to={urls.bucketPackageTree(bucket, handle, revision)}
            className={classes.mono}
          >
            {revision}
          </StyledLink>
        </Nowrap>{' '}
        <Nowrap>
          from <Bold>{lastModified.toLocaleString()}</Bold>
        </Nowrap>
      </p>
      <p className={classes.msg}>{comment || <i>No message</i>}</p>
      <p className={classes.hash}>{hash}</p>
    </M.Box>
  )
}

const getDefaultVersion = (versions) => versions.find((v) => !!v.id) || versions[0]

function ObjectHit({ showBucket, hit: { path, versions, bucket } }) {
  const v = getDefaultVersion(versions)
  const data = useBucketExistence(bucket)
  return (
    <Section>
      <ObjectHeader
        handle={{ bucket, key: path, version: v.id }}
        showBucket={showBucket}
        bucketExistenceData={data}
      />
      <VersionInfo bucket={bucket} path={path} version={v} versions={versions} />
      <Meta meta={v.meta} />
      <PreviewDisplay
        handle={{ bucket, key: path, version: v.id }}
        bucketExistenceData={data}
      />
    </Section>
  )
}

function PackageHit({
  showBucket,
  hit: { bucket, handle, revision, hash, lastModified, meta, tags, comment },
}) {
  return (
    <Section>
      <PackageHeader {...{ handle, bucket, revision, showBucket }} />
      <RevisionInfo {...{ bucket, handle, revision, hash, comment, lastModified }} />
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
  const Component = props.hit.type === 'object' ? ObjectHit : PackageHit
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
    [hits, actualPage, perPage],
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

export function Alt({ ...props }) {
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

export const handleErr = (retry) =>
  R.cond([
    [
      R.propEq('message', 'SearchSyntaxError'),
      (e) => (
        <Alt>
          <Message headline="Search syntax error">
            Oops, couldn&apos;t parse that search.
            <br />
            Try quoting your query or read about{' '}
            <StyledLink href={ES_REF}>supported query syntax</StyledLink>.
            {!!e.details && (
              <>
                <br />
                <br />
                Error details:
                <br />
                {e.details}
              </>
            )}
          </Message>
        </Alt>
      ),
    ],
    [
      R.propEq('message', 'TooManyRequests'),
      () => (
        <Alt>
          <Message headline="Too many requests">
            Processing a lot of requests. Please try your search again in a few minutes.
            {!!retry && (
              <>
                <br />
                <br />
                <M.Button onClick={retry} color="primary" variant="contained">
                  Retry
                </M.Button>
              </>
            )}
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
            {!!retry && (
              <>
                <br />
                <br />
                <M.Button onClick={retry} color="primary" variant="contained">
                  Retry
                </M.Button>
              </>
            )}
          </Message>
        </Alt>
      ),
    ],
  ])

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

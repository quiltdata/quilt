import cx from 'classnames'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as RC from 'recompose'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Icon,
  IconButton,
  Typography,
  colors,
} from '@material-ui/core'
import { withStyles } from '@material-ui/styles'

import * as Pagination from 'components/Pagination'
import * as Preview from 'components/Preview'
import Working from 'components/Working'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as BucketConfig from 'utils/BucketConfig'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import StyledLink, { linkStyle } from 'utils/StyledLink'
import * as RT from 'utils/reactTools'
import { getBreadCrumbs } from 'utils/s3paths'
import { readableBytes } from 'utils/string'
import withParsedQuery from 'utils/withParsedQuery'

import BreadCrumbs, { Crumb } from './BreadCrumbs'
import Message from './Message'
import * as requests from './requests'

const versionShape = PT.shape({
  id: PT.string.isRequired,
  updated: PT.instanceOf(Date).isRequired,
  size: PT.number.isRequired,
  type: PT.string.isRequired,
  meta: PT.any,
})

const handleShape = PT.shape({
  bucket: PT.string.isRequired,
  key: PT.string.isRequired,
  version: PT.string.isRequired,
})

const Crumbs = RT.composeComponent(
  'Bucket.Search.Crumbs',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    path: PT.string.isRequired,
    version: PT.string.isRequired,
  }),
  ({ bucket, path, version }) => {
    const { urls } = NamedRoutes.use()
    const items = R.intersperse(
      Crumb.Sep(' / '),
      getBreadCrumbs(path).map(({ label, path: segPath }) =>
        Crumb.Segment({
          label,
          to:
            // eslint-disable-next-line no-nested-ternary
            segPath === path
              ? version
                ? urls.bucketFile(bucket, segPath, version)
                : undefined
              : urls.bucketDir(bucket, segPath),
        }),
      ),
    )
    return <BreadCrumbs items={items} />
  },
)

const Header = RT.composeComponent(
  'Bucket.Search.Header',
  RC.setPropTypes({
    handle: handleShape.isRequired,
  }),
  withStyles(({ spacing: { unit } }) => ({
    root: {
      display: 'flex',
      marginBottom: unit,
    },
    spacer: {
      flexGrow: 1,
    },
    buttonContainer: {
      alignItems: 'center',
      display: 'flex',
      height: 32,
      justifyContent: 'center',
      width: 24,
    },
    button: {},
  })),
  ({ classes, handle: h }) => {
    const getUrl = AWS.Signer.useS3Signer()
    return (
      <div className={classes.root}>
        <Crumbs bucket={h.bucket} path={h.key} version={h.version} />
        <div className={classes.spacer} />
        {h.version ? (
          <span className={classes.buttonContainer}>
            <IconButton className={classes.button} href={getUrl(h)} title="Download">
              <Icon>arrow_downward</Icon>
            </IconButton>
          </span>
        ) : (
          <Chip label="DELETED" />
        )}
      </div>
    )
  },
)

const Section = RT.composeComponent(
  'Bucket.Search.Section',
  withStyles(({ spacing: { unit } }) => ({
    root: {
      marginTop: 2 * unit,
    },
  })),
  ({ classes, children }) => <div className={classes.root}>{children}</div>,
)

const SectionHeading = RT.composeComponent(
  'Bucket.Search.SectionHeading',
  ({ children, ...props }) => (
    <Typography variant="h6" {...props}>
      {children}
    </Typography>
  ),
)

const VersionInfo = RT.composeComponent(
  'Bucket.Search.VersionInfo',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    path: PT.string.isRequired,
    version: versionShape.isRequired,
    versions: PT.arrayOf(versionShape.isRequired).isRequired,
  }),
  withStyles(({ palette, typography }) => ({
    versionContainer: {
      color: palette.text.secondary,
      fontWeight: typography.fontWeightLight,
    },
    version: {
      fontFamily: typography.monospace.fontFamily,
      fontWeight: typography.fontWeightMedium,
    },
    bold: {
      color: palette.text.primary,
      fontWeight: typography.fontWeightRegular,
    },
    seeOther: {
      borderBottom: '1px dashed',
      cursor: 'pointer',
      ...linkStyle,
    },
  })),
  ({ classes, bucket, path, version, versions }) => {
    const { urls } = NamedRoutes.use()
    const [versionsShown, setVersionsShown] = React.useState(false)
    const toggleVersions = React.useCallback(() => {
      setVersionsShown(!versionsShown)
    }, [setVersionsShown, versionsShown])

    return (
      <React.Fragment>
        <Typography variant="subtitle1" className={classes.versionContainer}>
          {version.id ? (
            <span>
              {'Version '}
              <StyledLink
                to={urls.bucketFile(bucket, path, version.id)}
                className={classes.version}
              >
                {version.id}
              </StyledLink>
              {' from '}
              <span className={classes.bold}>{version.updated.toLocaleString()}</span>
              {' | '}
              <span className={classes.bold}>{readableBytes(version.size)}</span>
            </span>
          ) : (
            <span>
              <span className={classes.bold}>Deleted</span>
              {' on '}
              <span className={classes.bold}>{version.updated.toLocaleString()}</span>
            </span>
          )}
        </Typography>
        {versions.length > 1 && (
          <Typography>
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
            <span className={classes.seeOther} onClick={toggleVersions}>
              {versionsShown ? 'hide ' : 'show '} all versions ({versions.length})
            </span>
          </Typography>
        )}
        {versions.length > 1 && versionsShown && (
          <Section>
            <SectionHeading gutterBottom>Versions ordered by relevance</SectionHeading>
            {versions.map((v) => (
              <Typography
                key={`${v.updated.getTime()}:${v.id}`}
                variant="body2"
                className={classes.versionContainer}
              >
                {v.id ? (
                  <span>
                    <StyledLink
                      to={urls.bucketFile(bucket, path, v.id)}
                      className={classes.version}
                    >
                      {v.id}
                    </StyledLink>
                    {' from '}
                    <span className={classes.bold}>{v.updated.toLocaleString()}</span>
                    {' | '}
                    <span className={classes.bold}>{readableBytes(v.size)}</span>
                  </span>
                ) : (
                  <span>
                    <span className={classes.bold}>Deleted</span>
                    {' on '}
                    <span className={classes.bold}>{v.updated.toLocaleString()}</span>
                  </span>
                )}
              </Typography>
            ))}
          </Section>
        )}
      </React.Fragment>
    )
  },
)

const PreviewBox = RT.composeComponent(
  'Bucket.Search.PreviewBox',
  RC.setPropTypes({
    data: PT.object.isRequired, // PreviewData
  }),
  withStyles(({ spacing: { unit }, shape: { borderRadius }, palette }) => ({
    root: {
      border: `1px solid ${palette.grey[300]}`,
      borderRadius,
      maxHeight: unit * 30,
      marginTop: unit,
      minHeight: unit * 15,
      overflow: 'hidden',
      padding: unit * 2,
      position: 'relative',

      '& img': {
        marginLeft: 'auto',
        marginRight: 'auto',
      },
    },
    expanded: {
      maxHeight: 'none',
    },
    fade: {
      alignItems: 'flex-end',
      background:
        'linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0.9), rgba(255,255,255,0))',
      bottom: 0,
      display: 'flex',
      height: unit * 10,
      justifyContent: 'center',
      left: 0,
      padding: unit,
      position: 'absolute',
      width: '100%',
      zIndex: 1,
    },
  })),
  ({ classes, data }) => {
    const [expanded, setExpanded] = React.useState(false)
    const expand = React.useCallback(() => {
      setExpanded(true)
    }, [setExpanded])
    return (
      <div className={cx(classes.root, { [classes.expanded]: expanded })}>
        {Preview.render(data)}
        {!expanded && (
          <div className={classes.fade}>
            <Button variant="outlined" onClick={expand}>
              Expand
            </Button>
          </div>
        )}
      </div>
    )
  },
)

const PreviewDisplay = RT.composeComponent(
  'Bucket.Search.PreviewDisplay',
  RC.setPropTypes({
    handle: handleShape.isRequired,
  }),
  ({ handle }) =>
    !handle.version ? null : (
      <Section>
        <SectionHeading>Preview</SectionHeading>
        {Preview.load(
          handle,
          AsyncResult.case({
            Ok: AsyncResult.case({
              Init: (_, { fetch }) => (
                <Typography variant="body1">
                  Large files are not previewed by default{' '}
                  <Button variant="outlined" size="small" onClick={fetch}>
                    Load preview
                  </Button>
                </Typography>
              ),
              Pending: () => <CircularProgress />,
              Err: (_, { fetch }) => (
                <Typography variant="body1">
                  Error loading preview{' '}
                  <Button variant="outlined" size="small" onClick={fetch}>
                    Retry
                  </Button>
                </Typography>
              ),
              Ok: (data) => <PreviewBox data={data} />,
            }),
            Err: () => <Typography variant="body1">Preview not available</Typography>,
            _: () => <CircularProgress />,
          }),
        )}
      </Section>
    ),
)

const Meta = RT.composeComponent(
  'Bucket.Search.Meta',
  withStyles(({ spacing: { unit } }) => ({
    meta: {
      background: colors.lightBlue[50],
      borderColor: colors.lightBlue[400],
      marginBottom: 0,
      marginTop: unit,
      opacity: 0.7,
    },
  })),
  ({ classes, meta }) =>
    !meta || R.isEmpty(meta) ? null : (
      <Section>
        <SectionHeading>Metadata</SectionHeading>
        <pre className={classes.meta}>{JSON.stringify(meta, null, 2)}</pre>
      </Section>
    ),
)

const getDefaultVersion = (versions) => versions.find((v) => !!v.id) || versions[0]

const Hit = RT.composeComponent(
  'Bucket.Search.Hit',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    hit: PT.shape({
      path: PT.string.isRequired,
      versions: PT.arrayOf(versionShape.isRequired).isRequired,
    }).isRequired,
  }),
  RC.withProps(({ hit: { versions } }) => ({
    version: getDefaultVersion(versions),
  })),
  withStyles(({ spacing: { unit } }) => ({
    root: {
      marginBottom: 2 * unit,
    },
  })),
  ({ classes, bucket, hit: { path, versions }, version: v }) => (
    <Card className={classes.root}>
      <CardContent>
        <Header handle={{ bucket, key: path, version: v.id }} />
        <VersionInfo bucket={bucket} path={path} version={v} versions={versions} />
        <Meta meta={v.meta} />
        <PreviewDisplay handle={{ bucket, key: path, version: v.id }} />
      </CardContent>
    </Card>
  ),
)

const Browse = RT.composeComponent(
  'Bucket.Search.Browse',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
  }),
  ({ bucket }) => {
    const { urls } = NamedRoutes.use()
    return (
      <Button component={Link} to={urls.bucketRoot(bucket)} variant="outlined">
        Browse the bucket
      </Button>
    )
  },
)

const SearchResource = Cache.createResource({
  name: 'Bucket.Search.results',
  fetch: requests.search,
  key: ({ query }) => query,
})

const Results = RT.composeComponent(
  'Bucket.Search.Results',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    query: PT.string.isRequired,
    searchEndpoint: PT.string.isRequired,
  }),
  withStyles(({ spacing: { unit } }) => ({
    heading: {
      marginBottom: 2 * unit,
      marginTop: 2 * unit,
    },
  })),
  ({ classes, bucket, query, searchEndpoint }) => {
    const es = AWS.ES.use({ host: searchEndpoint })
    const cache = Cache.use()
    const scrollRef = React.useRef(null)
    const scroll = React.useCallback((prev) => {
      if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
    })

    try {
      const { total, hits } = cache.get(SearchResource, { es, query })
      return (
        <React.Fragment>
          <Typography variant="h5" className={classes.heading}>
            {total
              ? `Search results for "${query}" (${total} hits, ${hits.length} files)`
              : `Nothing found for "${query}"`}
          </Typography>
          <div ref={scrollRef} />
          {total ? (
            <Pagination.Paginate items={hits} onChange={scroll}>
              {({ paginated, ...props }) => (
                <React.Fragment>
                  {paginated.map((hit) => (
                    <Hit key={hit.path} bucket={bucket} hit={hit} />
                  ))}
                  {props.pages > 1 && (
                    <Box mt={2}>
                      <Pagination.Controls {...props} />
                    </Box>
                  )}
                </React.Fragment>
              )}
            </Pagination.Paginate>
          ) : (
            <React.Fragment>
              <Typography variant="body1">
                We have not found anything matching your query
              </Typography>
              <br />
              <Browse bucket={bucket} />
            </React.Fragment>
          )}
        </React.Fragment>
      )
    } catch (e) {
      if (e instanceof Promise) throw e

      return (
        <Message headline="Server Error">
          Something went wrong.
          <br />
          <br />
          <Button
            // TODO: fix retry
            // onClick={fetch}
            color="primary"
            variant="contained"
          >
            Retry
          </Button>
        </Message>
      )
    }
  },
)

export default RT.composeComponent(
  'Bucket.Search',
  withParsedQuery,
  ({
    location: {
      query: { q: query = '' },
    },
  }) => {
    const { name, searchEndpoint } = BucketConfig.useCurrentBucketConfig()
    return searchEndpoint ? (
      <React.Suspense fallback={<Working>Searching</Working>}>
        <Results {...{ bucket: name, searchEndpoint, query }} />
      </React.Suspense>
    ) : (
      <Message headline="Search Not Available">
        This bucket has no configured search endpoint.
      </Message>
    )
  },
)

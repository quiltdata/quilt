import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Preview from 'components/Preview'
import { Section, Heading } from 'components/ResponsiveSection'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink, { linkStyle } from 'utils/StyledLink'
import { getBreadCrumbs } from 'utils/s3paths'
import { readableBytes } from 'utils/string'

const CrumbLink = M.styled(StyledLink)({ wordBreak: 'break-word' })

function Crumbs({ handle, showBucket = false }) {
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

  const handleCopy = React.useCallback((e) => {
    if (typeof document === 'undefined') return
    e.clipboardData.setData(
      'text/plain',
      document
        .getSelection()
        .toString()
        .replace(/\s*\/\s*/g, '/'),
    )
    e.preventDefault()
  }, [])

  return (
    <span onCopy={handleCopy}>
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

function Header({ handle, showBucket }) {
  const getUrl = AWS.Signer.useS3Signer()
  return (
    <Heading display="flex" mb={1}>
      <Crumbs {...{ handle, showBucket }} />
      <M.Box flexGrow={1} />
      <M.Box
        alignItems="center"
        display="flex"
        height={32}
        justifyContent="center"
        width={24}
        my={{ xs: -0.25, md: 0 }}
      >
        <M.IconButton href={getUrl(handle)} title="Download" download>
          <M.Icon>arrow_downward</M.Icon>
        </M.IconButton>
      </M.Box>
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

function PreviewDisplay({ handle }) {
  if (!handle.version) return null
  return (
    <SmallerSection>
      <SectionHeading>Preview</SectionHeading>
      {Preview.load(
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
          Err: () => <M.Typography variant="body1">Preview not available</M.Typography>,
          _: () => <M.CircularProgress />,
        }),
      )}
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
        mb={0}
        mt={1}
        style={{ opacity: 0.7 }}
      >
        {JSON.stringify(meta, null, 2)}
      </M.Box>
    </SmallerSection>
  )
}

const getDefaultVersion = (versions) => versions.find((v) => !!v.id) || versions[0]

export function Hit({ showBucket, hit: { path, versions, bucket } }) {
  const v = getDefaultVersion(versions)
  return (
    <Section>
      <Header handle={{ bucket, key: path, version: v.id }} showBucket={showBucket} />
      <VersionInfo bucket={bucket} path={path} version={v} versions={versions} />
      <Meta meta={v.meta} />
      <PreviewDisplay handle={{ bucket, key: path, version: v.id }} />
    </Section>
  )
}

import { basename } from 'path'

import cx from 'classnames'
import * as dateFns from 'date-fns'
import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import Skeleton from 'components/Skeleton'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link, { linkStyle } from 'utils/StyledLink'
import { getBreadCrumbs, getPrefix, isDir, parseS3Url, up, decode } from 'utils/s3paths'
import tagged from 'utils/tagged'

import Code from './Code'
import FilePreview from './FilePreview'
import Listing, { ListingItem } from './Listing'
import Section from './Section'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

const MAX_REVISIONS = 5

const useRevisionInfoStyles = M.makeStyles((t) => ({
  revision: {
    ...linkStyle,
    alignItems: 'center',
    display: 'inline-flex',
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  line: {
    whiteSpace: 'nowrap',
  },
  secondaryText: {
    display: 'block',
    height: 40,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  list: {
    width: 420,
  },
}))

function RevisionInfo({ revision, bucket, name, path }) {
  const s3req = AWS.S3.useRequest()
  const sign = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint: endpoint } = Config.useConfig()
  const { urls } = NamedRoutes.use()
  const today = React.useMemo(() => new Date(), [])

  const [anchor, setAnchor] = React.useState()
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  const classes = useRevisionInfoStyles()

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span className={classes.revision} onClick={open} ref={setAnchor}>
        {revision === 'latest' ? (
          'latest'
        ) : (
          <span className={classes.mono}>{revision}</span>
        )}{' '}
        <M.Icon>expand_more</M.Icon>
      </span>
      <Data fetch={requests.getPackageRevisions} params={{ s3req, bucket, name, today }}>
        {R.pipe(
          AsyncResult.case({
            Ok: ({ revisions, isTruncated }) => {
              const revList = revisions.slice(0, MAX_REVISIONS).map((r) => (
                <Data
                  key={r}
                  fetch={requests.getRevisionData}
                  params={{ s3req, sign, endpoint, bucket, name, id: r, maxKeys: 0 }}
                >
                  {(res) => {
                    const modified =
                      r === 'latest'
                        ? AsyncResult.prop('modified', res)
                        : AsyncResult.Ok(new Date(parseInt(r, 10) * 1000))
                    const hash = AsyncResult.prop('hash', res)
                    const msg = AsyncResult.prop('message', res)
                    return (
                      <M.ListItem
                        key={r}
                        button
                        onClick={close}
                        selected={r === revision}
                        component={RRLink}
                        to={urls.bucketPackageTree(bucket, name, r, path)}
                      >
                        <M.ListItemText
                          primary={
                            <>
                              {r === 'latest' ? (
                                'LATEST'
                              ) : (
                                <span className={classes.mono}>{r}</span>
                              )}
                              {AsyncResult.case(
                                {
                                  _: () => null,
                                  Ok: (d) => (
                                    <>
                                      {' | '}
                                      {dateFns.format(d, 'MMMM Do YYYY - h:mmA')}
                                    </>
                                  ),
                                },
                                modified,
                              )}
                            </>
                          }
                          secondary={
                            <span className={classes.secondaryText}>
                              {AsyncResult.case(
                                {
                                  Ok: (v) => (
                                    <span className={classes.line}>
                                      {v || <i>No message</i>}
                                    </span>
                                  ),
                                  _: () => (
                                    <Skeleton
                                      component="span"
                                      display="inline-block"
                                      borderRadius="borderRadius"
                                      height={16}
                                      width="90%"
                                    />
                                  ),
                                },
                                msg,
                              )}
                              <br />
                              {AsyncResult.case(
                                {
                                  Ok: (v) => (
                                    <span className={cx(classes.line, classes.mono)}>
                                      {v}
                                    </span>
                                  ),
                                  _: () => (
                                    <Skeleton
                                      component="span"
                                      display="inline-block"
                                      borderRadius="borderRadius"
                                      height={16}
                                      width="95%"
                                    />
                                  ),
                                },
                                hash,
                              )}
                            </span>
                          }
                        />
                      </M.ListItem>
                    )
                  }}
                </Data>
              ))
              if (isTruncated) {
                revList.unshift(
                  <M.ListItem key="__truncated">
                    <M.ListItemText
                      primary="Revision list is truncated"
                      secondary="Latest revisions are not shown"
                    />
                    <M.ListItemSecondaryAction>
                      <M.Icon>warning</M.Icon>
                    </M.ListItemSecondaryAction>
                  </M.ListItem>,
                )
              }
              return revList
            },
            Err: () => (
              <M.ListItem>
                <M.ListItemIcon>
                  <M.Icon>error</M.Icon>
                </M.ListItemIcon>
                <M.Typography variant="body1">Error fetching revisions</M.Typography>
              </M.ListItem>
            ),
            _: () => (
              <M.ListItem>
                <M.ListItemIcon>
                  <M.CircularProgress size={24} />
                </M.ListItemIcon>
                <M.Typography variant="body1">Fetching revisions</M.Typography>
              </M.ListItem>
            ),
          }),
          (children) => (
            <M.Popover
              open={opened && !!anchor}
              anchorEl={anchor}
              onClose={close}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
              <M.List className={classes.list}>
                {children}
                <M.Divider />
                <M.ListItem
                  button
                  onClick={close}
                  component={RRLink}
                  to={urls.bucketPackageRevisions(bucket, name)}
                >
                  <M.Box textAlign="center" width="100%">
                    Show all revisions
                  </M.Box>
                </M.ListItem>
              </M.List>
            </M.Popover>
          ),
        )}
      </Data>
    </>
  )
}

const TreeDisplay = tagged([
  'File', // S3Handle
  'Dir', // { files, dirs, truncated }
  'NotFound',
])

const mkHandle = ({ logicalKey, physicalKey, size }) => ({
  ...parseS3Url(physicalKey),
  size,
  logicalKey,
})

const getParents = (path) => (path ? [...getParents(up(path)), path] : [])

const computeTree = ({ bucket, name, revision, path }) => ({ keys, truncated }) => {
  if (isDir(path)) {
    return TreeDisplay.Dir({
      dirs: R.pipe(
        R.map((info) => getPrefix(info.logicalKey)),
        R.uniq,
        R.chain(getParents),
        R.uniq,
        R.filter((dir) => up(dir) === path),
      )(keys),
      files: keys.filter((info) => getPrefix(info.logicalKey) === path).map(mkHandle),
      bucket,
      name,
      revision,
      path,
      truncated,
    })
  }

  const key = keys.find(R.propEq('logicalKey', path))
  return key ? TreeDisplay.File(mkHandle(key)) : TreeDisplay.NotFound()
}

const formatListing = ({ urls }, r) => {
  const dirs = r.dirs.map((dir) =>
    ListingItem.Dir({
      name: basename(dir),
      to: urls.bucketPackageTree(r.bucket, r.name, r.revision, dir),
    }),
  )
  const files = r.files.map(({ logicalKey, size, modified }) =>
    ListingItem.File({
      name: basename(logicalKey),
      to: urls.bucketPackageTree(r.bucket, r.name, r.revision, logicalKey),
      size,
      modified,
    }),
  )
  return [
    ...(r.path !== ''
      ? [
          ListingItem.Dir({
            name: '..',
            to: urls.bucketPackageTree(r.bucket, r.name, r.revision, up(r.path)),
          }),
        ]
      : []),
    ...dirs,
    ...files,
  ]
}

const withComputedTree = (params, fn) =>
  R.pipe(
    AsyncResult.case({
      Ok: R.pipe(computeTree(params), AsyncResult.Ok),
      _: R.identity,
    }),
    fn,
  )

const useStyles = M.makeStyles((t) => ({
  topBar: {
    alignItems: 'flex-end',
    display: 'flex',
    marginBottom: t.spacing(2),
  },
  crumbs: {
    ...t.typography.body1,
    maxWidth: 'calc(100% - 160px)',
    overflowWrap: 'break-word',
    [t.breakpoints.down('xs')]: {
      maxWidth: 'calc(100% - 40px)',
    },
  },
  name: {
    wordBreak: 'break-all',
  },
  spacer: {
    flexGrow: 1,
  },
  button: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
  warning: {
    background: t.palette.warning.light,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    padding: t.spacing(1.5),
    ...t.typography.body2,
  },
  warningIcon: {
    height: 20,
    lineHeight: '20px',
    marginRight: t.spacing(1),
    opacity: 0.6,
  },
}))

export default function PackageTree({
  match: {
    params: { bucket, name, revision = 'latest', path: encodedPath = '' },
  },
}) {
  const classes = useStyles()
  const s3req = AWS.S3.useRequest()
  const { urls } = NamedRoutes.use()
  const getSignedS3URL = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint: endpoint } = Config.useConfig()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const path = decode(encodedPath)

  // TODO: handle revision / hash
  const code = dedent`
    import quilt3
    p = quilt3.Package.browse("${name}", registry="s3://${bucket}")
  `

  const crumbs = React.useMemo(() => {
    const segments = getBreadCrumbs(path)
    if (path !== '') segments.unshift({ label: 'ROOT', path: '' })
    return R.intersperse(
      Crumb.Sep(<>&nbsp;/ </>),
      segments.map(({ label, path: segPath }) =>
        Crumb.Segment({
          label,
          to:
            path === segPath
              ? undefined
              : urls.bucketPackageTree(bucket, name, revision, segPath),
        }),
      ),
    ).concat(path.endsWith('/') ? Crumb.Sep(<>&nbsp;/</>) : [])
  }, [bucket, name, revision, path, urls])

  return (
    <M.Box pt={2} pb={4}>
      <Data
        fetch={requests.fetchPackageTree}
        params={{ s3req, sign: getSignedS3URL, endpoint, bucket, name, revision }}
      >
        {withComputedTree({ bucket, name, revision, path }, (result) => (
          <>
            <M.Typography variant="body1">
              <Link to={urls.bucketPackageDetail(bucket, name)} className={classes.name}>
                {name}
              </Link>
              {' @ '}
              <RevisionInfo {...{ revision, bucket, name, path }} />
            </M.Typography>
            <div className={classes.topBar}>
              <div className={classes.crumbs} onCopy={copyWithoutSpaces}>
                {renderCrumbs(crumbs)}
              </div>
              <div className={classes.spacer} />
              {AsyncResult.case(
                {
                  Ok: TreeDisplay.case({
                    File: ({ key, version }) =>
                      xs ? (
                        <M.IconButton
                          className={classes.button}
                          href={getSignedS3URL({ bucket, key, version })}
                          edge="end"
                          size="small"
                          download
                        >
                          <M.Icon>arrow_downward</M.Icon>
                        </M.IconButton>
                      ) : (
                        <M.Button
                          href={getSignedS3URL({ bucket, key, version })}
                          className={classes.button}
                          variant="outlined"
                          size="small"
                          startIcon={<M.Icon>arrow_downward</M.Icon>}
                          download
                        >
                          Download file
                        </M.Button>
                      ),
                    _: () => null,
                  }),
                  _: () => null,
                },
                result,
              )}
            </div>

            <M.Box className={classes.warning} mb={2}>
              <M.Icon className={classes.warningIcon}>warning</M.Icon>
              The Packages tab shows only the first 1,000 files. Use the Files tab (above)
              or Python code (below) to view all files. This is a temporary limitation.
            </M.Box>

            <Section icon="code" heading="Code">
              <Code>{code}</Code>
            </Section>

            {AsyncResult.case(
              {
                Ok: TreeDisplay.case({
                  File: (handle) => (
                    <Section icon="remove_red_eye" heading="Contents" expandable={false}>
                      <FilePreview handle={handle} />
                    </Section>
                  ),
                  Dir: ({ truncated, ...dir }) => (
                    <M.Box mt={2}>
                      <Listing
                        items={formatListing({ urls }, dir)}
                        truncated={truncated}
                      />
                      {/* TODO: use proper versions */}
                      <Summary files={dir.files} />
                    </M.Box>
                  ),
                  NotFound: () => (
                    <M.Box mt={4}>
                      <M.Typography variant="h4" align="center">
                        No such file
                      </M.Typography>
                    </M.Box>
                  ),
                }),
                Err: displayError(),
                _: () => (
                  // TODO: skeleton placeholder
                  <M.Box mt={2}>
                    <M.CircularProgress />
                  </M.Box>
                ),
              },
              result,
            )}
          </>
        ))}
      </Data>
    </M.Box>
  )
}

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
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import Data, { useData } from 'utils/Data'
import * as LinkedData from 'utils/LinkedData'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link, { linkStyle } from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'

import Code from './Code'
import FilePreview from './FilePreview'
import Listing, { ListingItem } from './Listing'
import Section from './Section'
import Summary from './Summary'
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
  const s3 = AWS.S3.use()
  const sign = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint: endpoint } = Config.useConfig()
  const { urls } = NamedRoutes.use()
  const today = React.useMemo(() => new Date(), [])

  const [anchor, setAnchor] = React.useState()
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  const classes = useRevisionInfoStyles()

  const data = useData(requests.getPackageRevisions, { s3, bucket, name, today })

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

      <M.Popover
        open={opened && !!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <M.List className={classes.list}>
          {data.case({
            Ok: ({ revisions, isTruncated }) => {
              const revList = revisions.slice(0, MAX_REVISIONS).map((r) => (
                <Data
                  key={r}
                  fetch={requests.getRevisionData}
                  params={{ s3, sign, endpoint, bucket, name, id: r, maxKeys: 0 }}
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
                                      {dateFns.format(d, 'MMMM do yyyy - h:mma')}
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
          })}
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
    </>
  )
}

function ExposeLinkedData({ bucketCfg, bucket, name, revision }) {
  const s3 = AWS.S3.use()
  const sign = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint: endpoint } = Config.use()
  const data = useData(requests.getRevisionData, {
    s3,
    sign,
    endpoint,
    bucket,
    name,
    id: revision,
    maxKeys: 0,
  })
  return data.case({
    _: () => null,
    Ok: ({ hash, modified, header }) => (
      <React.Suspense fallback={null}>
        <LinkedData.PackageData
          {...{ bucket: bucketCfg, name, revision, hash, modified, header }}
        />
      </React.Suspense>
    ),
  })
}

function PkgCode({ data, bucket, name, revision, path }) {
  const code = data.case({
    Ok: ({ hash }) => {
      const nameWithPath = path ? `${name}/${path}` : name
      const hashDisplay = revision === 'latest' ? '' : hash.substring(0, 10)
      const hashPy = hashDisplay && `, top_hash="${hashDisplay}"`
      const hashCli = hashDisplay && ` --top-hash ${hashDisplay}`
      return [
        {
          label: 'Python',
          hl: 'python',
          contents: dedent`
            import quilt3
            # browse
            quilt3.Package.browse("${name}"${hashPy}, registry="s3://${bucket}")
            # download
            quilt3.Package.install("${nameWithPath}"${hashPy}, registry="s3://${bucket}", dest=".")
          `,
        },
        {
          label: 'CLI',
          hl: 'bash',
          contents: dedent`
            quilt3 install ${nameWithPath}${hashCli} --registry s3://${bucket} --dest .
          `,
        },
      ]
    },
    _: () => null,
  })
  return code && <Code>{code}</Code>
}

function DirDisplay({ bucket, name, revision, path }) {
  const s3 = AWS.S3.use()
  const { apiGatewayEndpoint: endpoint } = Config.use()
  const credentials = AWS.Credentials.use()
  const { urls } = NamedRoutes.use()

  const data = useData(requests.packageSelect, {
    s3,
    credentials,
    endpoint,
    bucket,
    name,
    revision,
    prefix: path,
  })

  const hashData = useData(requests.loadRevisionHash, { s3, bucket, name, id: revision })

  const resolveLogicalKey = React.useCallback(
    (logicalKey) =>
      requests.packageFileDetail({
        s3,
        credentials,
        endpoint,
        bucket,
        name,
        revision,
        path: logicalKey,
      }),
    [s3, credentials, endpoint, bucket, name, revision, path],
  )

  const mkUrl = React.useCallback(
    (handle) => urls.bucketPackageTree(bucket, name, revision, handle.logicalKey),
    [urls.bucketPackageTree, bucket, name, revision, path],
  )

  return data.case({
    Ok: ({ objects, prefixes }) => {
      const up =
        path === ''
          ? []
          : [
              ListingItem.Dir({
                name: '..',
                to: urls.bucketPackageTree(bucket, name, revision, s3paths.up(path)),
              }),
            ]
      const dirs = prefixes.map((p) =>
        ListingItem.Dir({
          name: s3paths.ensureNoSlash(p),
          to: urls.bucketPackageTree(bucket, name, revision, path + p),
        }),
      )
      const files = objects.map((basename) =>
        ListingItem.File({
          name: basename,
          to: urls.bucketPackageTree(bucket, name, revision, path + basename),
        }),
      )
      const items = [...up, ...dirs, ...files]
      const lazyHandles = objects.map((basename) => ({ logicalKey: path + basename }))
      return (
        <>
          <PkgCode {...{ data: hashData, bucket, name, revision, path }} />
          <M.Box mt={2}>
            <Listing items={items} />
            <Summary
              files={lazyHandles}
              resolveLogicalKey={resolveLogicalKey}
              mkUrl={mkUrl}
            />
          </M.Box>
        </>
      )
    },
    Err: (e) => {
      console.error(e)
      return (
        <M.Box mt={4}>
          <M.Typography variant="h4" align="center" gutterBottom>
            Error loading directory
          </M.Typography>
          <M.Typography variant="body1" align="center">
            Seems like there&apos;s no such directory in this package
          </M.Typography>
        </M.Box>
      )
    },
    _: () => (
      // TODO: skeleton placeholder
      <M.Box mt={2}>
        <M.CircularProgress />
      </M.Box>
    ),
  })
}

function FileDisplay({ bucket, name, revision, path }) {
  const s3 = AWS.S3.use()
  const { apiGatewayEndpoint: endpoint } = Config.use()
  const credentials = AWS.Credentials.use()

  const data = useData(requests.packageFileDetail, {
    s3,
    credentials,
    endpoint,
    bucket,
    name,
    revision,
    path,
  })

  const hashData = useData(requests.loadRevisionHash, { s3, bucket, name, id: revision })

  return data.case({
    Ok: (handle) => (
      <>
        <PkgCode {...{ data: hashData, bucket, name, revision, path }} />
        <Section icon="remove_red_eye" heading="Preview" expandable={false}>
          <FilePreview handle={handle} />
        </Section>
      </>
    ),
    Err: (e) => {
      console.error(e)
      return (
        <M.Box mt={4}>
          <M.Typography variant="h4" align="center" gutterBottom>
            Error loading file
          </M.Typography>
          <M.Typography variant="body1" align="center">
            Seems like there&apos;s no such file in this package
          </M.Typography>
        </M.Box>
      )
    },
    _: () => (
      // TODO: skeleton placeholder
      <M.Box mt={2}>
        <M.CircularProgress />
      </M.Box>
    ),
  })
}

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
  const s3 = AWS.S3.use()
  const { urls } = NamedRoutes.use()
  const getSignedS3URL = AWS.Signer.useS3Signer()
  const { apiGatewayEndpoint: endpoint, noDownload } = Config.use()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const credentials = AWS.Credentials.use()
  const bucketCfg = BucketConfig.useCurrentBucketConfig()

  const path = s3paths.decode(encodedPath)
  const isDir = s3paths.isDir(path)

  const crumbs = React.useMemo(() => {
    const segments = s3paths.getBreadCrumbs(path)
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
      {!!bucketCfg && <ExposeLinkedData {...{ bucketCfg, bucket, name, revision }} />}
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
        {!noDownload && !isDir && (
          <Data
            fetch={requests.packageFileDetail}
            params={{ s3, credentials, endpoint, bucket, name, revision, path }}
          >
            {AsyncResult.case({
              Ok: (handle) =>
                xs ? (
                  <M.IconButton
                    className={classes.button}
                    href={getSignedS3URL(handle)}
                    edge="end"
                    size="small"
                    download
                  >
                    <M.Icon>arrow_downward</M.Icon>
                  </M.IconButton>
                ) : (
                  <M.Button
                    href={getSignedS3URL(handle)}
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
            })}
          </Data>
        )}
      </div>

      {isDir ? (
        <DirDisplay {...{ bucket, name, revision, path }} />
      ) : (
        <FileDisplay {...{ bucket, name, revision, path }} />
      )}
    </M.Box>
  )
}

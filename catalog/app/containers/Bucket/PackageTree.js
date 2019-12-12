import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { Crumb, copyWithoutSpaces, render as renderCrumbs } from 'components/BreadCrumbs'
import { ThrowNotFound } from 'containers/NotFoundPage'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'
import { getBreadCrumbs, getPrefix, isDir, parseS3Url, up, decode } from 'utils/s3paths'
import tagged from 'utils/tagged'

import Code from './Code'
import FilePreview from './FilePreview'
import Listing, { ListingItem } from './Listing'
import Section from './Section'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

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
}))

export default function PackageTree({
  match: {
    params: { bucket, name, revision, path: encodedPath = '' },
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

  const crumbs = React.useMemo(
    () =>
      R.intersperse(
        Crumb.Sep(<>&nbsp;/ </>),
        getBreadCrumbs(path).map(({ label, path: segPath }) =>
          Crumb.Segment({
            label,
            to:
              path === segPath
                ? undefined
                : urls.bucketPackageTree(bucket, name, revision, segPath),
          }),
        ),
      ),
    [bucket, name, revision, path, urls],
  )

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
              <Link to={urls.bucketPackageTree(bucket, name, revision)}>{revision}</Link>:
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
                  NotFound: ThrowNotFound,
                }),
                Err: displayError(),
                _: () => <M.CircularProgress />,
              },
              result,
            )}
          </>
        ))}
      </Data>
    </M.Box>
  )
}

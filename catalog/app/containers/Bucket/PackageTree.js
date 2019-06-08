import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import { unstable_Box as Box } from '@material-ui/core/Box'
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/styles'

import { ThrowNotFound } from 'containers/NotFoundPage'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import { getBreadCrumbs, getPrefix, isDir, parseS3Url, up } from 'utils/s3paths'
import tagged from 'utils/tagged'

import BreadCrumbs, { Crumb } from './BreadCrumbs'
import Code from './Code'
import FilePreview from './FilePreview'
import Listing, { ListingItem } from './Listing'
import Section from './Section'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

const TreeDisplay = tagged([
  'File', // S3Handle
  'Dir', // { files, dirs }
  'NotFound',
])

const mkHandle = ({ logical_key: logicalKey, physical_keys: [key], size }) => ({
  ...parseS3Url(key),
  size,
  logicalKey,
})

const getParents = (path) => (path ? [...getParents(up(path)), path] : [])

const computeTree = ({ bucket, name, revision, path }) =>
  R.pipe(
    R.prop('keys'),
    R.ifElse(
      () => isDir(path),
      R.pipe(
        R.applySpec({
          dirs: R.pipe(
            // eslint-disable-next-line camelcase
            R.map((info) => getPrefix(info.logical_key)),
            R.uniq,
            R.chain(getParents),
            R.uniq,
            R.filter((dir) => up(dir) === path),
          ),
          files: R.pipe(
            // eslint-disable-next-line camelcase
            R.filter((info) => getPrefix(info.logical_key) === path),
            R.map(mkHandle),
          ),
          bucket: () => bucket,
          name: () => name,
          revision: () => revision,
          path: () => path,
        }),
        TreeDisplay.Dir,
      ),
      (keys) => {
        const key = keys.find(R.propEq('logical_key', path))
        return key ? TreeDisplay.File(mkHandle(key)) : TreeDisplay.NotFound()
      },
    ),
  )

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
      Ok: R.pipe(
        computeTree(params),
        AsyncResult.Ok,
      ),
      _: R.identity,
    }),
    fn,
  )

const Crumbs = ({ bucket, name, revision, path }) => {
  const { urls } = NamedRoutes.use()
  const crumbs = React.useMemo(
    () => [
      Crumb.Segment({
        label: name,
        to: urls.bucketPackageDetail(bucket, name),
      }),
      Crumb.Sep('@'),
      Crumb.Segment({
        label: revision,
        to: urls.bucketPackageTree(bucket, name, revision),
      }),
      Crumb.Sep(': '),
      ...R.intersperse(
        Crumb.Sep(' / '),
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
    ],
    [bucket, name, revision, path, urls],
  )
  return <BreadCrumbs items={crumbs} />
}

const useStyles = makeStyles(({ spacing: { unit } }) => ({
  topBar: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    marginBottom: 2 * unit,
    marginTop: unit,
  },
  spacer: {
    flexGrow: 1,
  },
  button: {
    color: 'inherit !important',
    marginLeft: unit,
    textDecoration: 'none !important',
  },
}))

export default ({
  match: {
    params: { bucket, name, revision, path = '' },
  },
}) => {
  const classes = useStyles()
  const s3 = AWS.S3.use()
  const { urls } = NamedRoutes.use()
  const getSignedS3URL = AWS.Signer.useS3Signer()

  // TODO: handle revision / hash
  const code = dedent`
    import quilt3
    p = quilt3.Package.browse("${name}", registry="s3://${bucket}")
  `

  return (
    <Data params={{ s3, bucket, name, revision }} fetch={requests.fetchPackageTree}>
      {withComputedTree({ bucket, name, revision, path }, (result) => (
        <React.Fragment>
          <div className={classes.topBar}>
            <Crumbs {...{ bucket, name, revision, path }} />
            <div className={classes.spacer} />
            {AsyncResult.case(
              {
                Ok: TreeDisplay.case({
                  File: ({ key, version }) => (
                    <Button
                      variant="outlined"
                      href={getSignedS3URL({ bucket, key, version })}
                      className={classes.button}
                    >
                      Download file
                    </Button>
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
                Dir: (dir) => (
                  <Box mt={2}>
                    <Listing items={formatListing({ urls }, dir)} />
                    {/* TODO: use proper versions */}
                    <Summary files={dir.files} />
                  </Box>
                ),
                NotFound: ThrowNotFound,
              }),
              Err: displayError(),
              _: () => <CircularProgress />,
            },
            result,
          )}
        </React.Fragment>
      ))}
    </Data>
  )
}

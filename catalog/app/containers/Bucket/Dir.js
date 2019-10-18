import { basename } from 'path'

import dedent from 'dedent'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import BreadCrumbs, { Crumb } from 'components/BreadCrumbs'
import Message from 'components/Message'
import { docs } from 'constants/urls'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import Link from 'utils/StyledLink'
import { getBreadCrumbs, ensureNoSlash, withoutPrefix, up } from 'utils/s3paths'

import Code from './Code'
import Listing, { ListingItem } from './Listing'
import Section from './Section'
import Summary from './Summary'
import { displayError } from './errors'
import * as requests from './requests'

const HELP_LINK = `${docs}/walkthrough/working-with-a-bucket`

const getCrumbs = R.compose(
  R.intersperse(Crumb.Sep(' / ')),
  ({ bucket, path, urls }) =>
    [{ label: bucket, path: '' }, ...getBreadCrumbs(path)].map(
      ({ label, path: segPath }) =>
        Crumb.Segment({
          label,
          to: segPath === path ? undefined : urls.bucketDir(bucket, segPath),
        }),
    ),
)

const formatListing = ({ urls }, r) => {
  const dirs = r.dirs.map((name) =>
    ListingItem.Dir({
      name: ensureNoSlash(withoutPrefix(r.path, name)),
      to: urls.bucketDir(r.bucket, name),
    }),
  )
  const files = r.files.map(({ key, size, modified }) =>
    ListingItem.File({
      name: basename(key),
      to: urls.bucketFile(r.bucket, key),
      size,
      modified,
    }),
  )
  const items = [
    ...(r.path !== ''
      ? [
          ListingItem.Dir({
            name: '..',
            to: urls.bucketDir(r.bucket, up(r.path)),
          }),
        ]
      : []),
    ...dirs,
    ...files,
  ]
  // filter-out files with same name as one of dirs
  return R.uniqBy(ListingItem.case({ Dir: R.prop('name'), File: R.prop('name') }), items)
}

export default function Dir({
  match: {
    params: { bucket, path = '' },
  },
}) {
  const { urls } = NamedRoutes.use()
  const s3req = AWS.S3.useRequest()
  const code = dedent`
    import quilt3
    b = quilt3.Bucket("s3://${bucket}")
    b.fetch("${path}", "./")
  `

  return (
    <M.Box pt={2} pb={4}>
      <M.Box display="flex" alignItems="flex-start" mb={2}>
        <BreadCrumbs items={getCrumbs({ bucket, path, urls })} />
        <M.Box flexGrow={1} />
      </M.Box>

      <Section icon="code" heading="Code" gutterBottom>
        <Code>{code}</Code>
      </Section>

      <Data fetch={requests.bucketListing} params={{ s3req, bucket, path }}>
        {AsyncResult.case({
          Err: displayError(),
          Ok: (res) => {
            const items = formatListing({ urls }, res)
            return items.length ? (
              <>
                <Listing items={items} truncated={res.truncated} />
                <Summary files={res.files} />
              </>
            ) : (
              <Message headline="No files">
                <Link href={HELP_LINK}>Learn how to upload files</Link>.
              </Message>
            )
          },
          Pending: AsyncResult.case({
            Ok: (res) =>
              res ? (
                <>
                  <Listing
                    items={formatListing({ urls }, res)}
                    truncated={res.truncated}
                    locked
                  />
                  <Summary files={res.files} />
                </>
              ) : (
                <M.CircularProgress />
              ),
            _: () => null,
          }),
          Init: () => null,
        })}
      </Data>
    </M.Box>
  )
}

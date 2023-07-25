import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Message from 'components/Message'
import Placeholder from 'components/Placeholder'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'

import * as errors from '../errors'
import WithPackagesSupport from '../WithPackagesSupport'

import REVISION_QUERY from '../PackageTree/gql/Revision.generated'

interface PackageEditorQueriesProps {
  bucket: string
  name: string
  hashOrTag: string
  path: string
  resolvedFrom?: string
  mode?: string
  children: (props: RenderProps) => React.ReactNode
}

interface RenderProps {
  bucket: string
  name: string
  hashOrTag: string
  hash?: string
  path: string
  mode?: string
  resolvedFrom?: string
  size?: number
}

function PackageEditorQueries({
  bucket,
  name,
  hashOrTag,
  path,
  resolvedFrom,
  mode,
  children,
}: PackageEditorQueriesProps) {
  const revisionQuery = GQL.useQuery(REVISION_QUERY, { bucket, name, hashOrTag })

  return GQL.fold(revisionQuery, {
    fetching: () => <Placeholder color="text.secondary" />,
    error: (e) => errors.displayError()(e),
    data: (d) => {
      if (!d.package) {
        return (
          <Message headline="No Such Package">
            Package named{' '}
            <M.Box component="span" fontWeight="fontWeightMedium">{`"${name}"`}</M.Box>{' '}
            could not be found in this bucket.
          </Message>
        )
      }

      return children({
        bucket,
        name,
        hashOrTag,
        hash: d.package.revision?.hash,
        size: d.package.revision?.totalBytes ?? undefined,
        path,
        mode,
        resolvedFrom,
      })
    },
  })
}

interface PackageTreeRouteParams {
  bucket: string
  name: string
  revision?: string
  path?: string
}

export default function RouteContainer({
  match: {
    params: { bucket, name, revision: hashOrTag = 'latest', path: encodedPath = '' },
  },
  location,
  children,
}: RRDom.RouteComponentProps<PackageTreeRouteParams> & {
  children: (props: RenderProps) => React.ReactNode
}) {
  const path = s3paths.decode(encodedPath)
  // TODO: mode is "switch view mode" action, ex. mode=json, or type=json, or type=application/json
  const { resolvedFrom, mode } = parseSearch(location.search, true)
  return (
    <>
      <MetaTitle>{[`${name}@${R.take(10, hashOrTag)}/${path}`, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <PackageEditorQueries
          {...{
            bucket,
            name,
            hashOrTag,
            path,
            resolvedFrom,
            mode,
          }}
        >
          {children}
        </PackageEditorQueries>
      </WithPackagesSupport>
    </>
  )
}

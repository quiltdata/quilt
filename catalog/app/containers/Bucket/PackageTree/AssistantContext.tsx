import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as GQL from 'utils/GraphQL'
import * as S3Paths from 'utils/s3paths'
import * as XML from 'utils/XML'

import REVISION_QUERY from './gql/Revision.generated'

const MAX_METADATA_SIZE = 20_000

type RevisionData = NonNullable<
  GQL.DataForDoc<typeof REVISION_QUERY>['package']
>['revision']

function useMetadataContext(bucket: string, name: string, revision: RevisionData) {
  const messages = React.useMemo(() => {
    if (!revision) return []

    const { userMeta, __typename: ignore, ...systemMeta } = revision

    const msgs: string[] = []

    msgs.push(
      XML.tag(
        'package-info',
        {},
        JSON.stringify({ bucket, name, ...systemMeta }, null, 2),
      ).toString(),
    )

    if (userMeta) {
      const metaStr = JSON.stringify(userMeta, null, 2)
      const truncated = metaStr.length > MAX_METADATA_SIZE
      msgs.push(
        XML.tag(
          'package-metadata',
          { truncated },
          truncated ? metaStr.slice(0, MAX_METADATA_SIZE) : metaStr,
        ).toString(),
      )
    }

    return msgs
  }, [bucket, name, revision])
  return { messages }
}

interface PackageContextProps {
  bucket: string
  name: string
  path: string
  revision: RevisionData
}

export const PackageContext = Assistant.Context.LazyContext<PackageContextProps>(
  ({ bucket, name, path, revision }) =>
    Assistant.Context.merge(
      useMetadataContext(bucket, name, revision),
      ContextFiles.usePackageRootContextFiles(bucket, name),
      ContextFiles.usePackageDirContextFiles(bucket, name, S3Paths.getPrefix(path)),
    ),
)

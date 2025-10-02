import * as Eff from 'effect'
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
  return React.useMemo(() => {
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
}

interface PackageContextProps {
  bucket: string
  name: string
  path: string
  revision: RevisionData
}

export const PackageContext = Assistant.Context.LazyContext(
  ({ bucket, name, path, revision }: PackageContextProps) => {
    const dir = S3Paths.getPrefix(path)
    const dirMsgO = ContextFiles.usePackageDirContextFiles(bucket, name, dir)
    const rootMsgO = ContextFiles.usePackageRootContextFiles(bucket, name)
    const metadataMsg = useMetadataContext(bucket, name, revision)

    return {
      markers: {
        packageRootContextFilesReady: Eff.Option.isSome(rootMsgO),
        packageDirContextFilesReady: Eff.Option.isSome(dirMsgO),
      },
      messages: [
        ...metadataMsg,
        ...Eff.Option.getOrElse(rootMsgO, () => []),
        ...Eff.Option.getOrElse(dirMsgO, () => []),
      ],
    }
  },
)

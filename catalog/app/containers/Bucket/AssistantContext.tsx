import * as Eff from 'effect'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'

interface BucketContextProps {
  bucket: string
}

export const BucketContext = Assistant.Context.LazyContext(
  ({ bucket }: BucketContextProps) => {
    const messagesO = ContextFiles.useRootContextFiles(bucket)
    return {
      markers: { bucketContextFilesReady: Eff.Option.isSome(messagesO) },
      messages: Eff.Option.getOrUndefined(messagesO),
    }
  },
)

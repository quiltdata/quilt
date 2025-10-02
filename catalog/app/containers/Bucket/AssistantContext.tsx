import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'

interface BucketContextProps {
  bucket: string
}

export const BucketContext = Assistant.Context.LazyContext<BucketContextProps>(
  ({ bucket }) => ContextFiles.useBucketRootContextFiles(bucket),
)

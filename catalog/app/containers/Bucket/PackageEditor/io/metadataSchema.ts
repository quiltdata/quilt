import * as R from 'ramda'

import { L } from 'components/Form/Package/types'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'

import * as requests from '../../requests'

export default function useMetadataSchema(schemaUrl?: string) {
  const s3 = AWS.S3.use()
  const data = Data.use(
    requests.metadataSchema,
    { s3, schemaUrl },
    { noAutoFetch: !schemaUrl },
  )
  return data.case({
    Ok: R.identity,
    Err: R.identity,
    _: () => L,
  })
}

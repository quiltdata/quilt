import * as React from 'react'

import * as AWS from 'utils/AWS'

export const withDownloadUrl = (handle, callback) => (
  <AWS.Signer.Inject>
    {(signer) =>
      callback(
        signer.getSignedS3URL(handle, { ResponseContentDisposition: 'attachment' }),
      )
    }
  </AWS.Signer.Inject>
)

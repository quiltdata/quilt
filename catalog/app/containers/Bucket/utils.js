import * as React from 'react'

import * as AWS from 'utils/AWS'

export const withSignedUrl = (handle, callback) => (
  <AWS.Signer.Inject>
    {(signer) => callback(signer.getSignedS3URL(handle))}
  </AWS.Signer.Inject>
)

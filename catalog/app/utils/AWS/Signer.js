import SignerV4 from 'aws-sdk/lib/signers/v4'
import PT from 'prop-types'
import * as React from 'react'
import { setPropTypes } from 'recompose'

import * as Resource from 'utils/Resource'
import { composeComponent, composeHOC } from 'utils/reactTools'
import { resolveKey } from 'utils/s3paths'

import * as Credentials from './Credentials'
import * as S3 from './S3'

const DEFAULT_URL_EXPIRATION = 5 * 60 // in seconds

export const useRequestSigner = () => {
  const credentials = Credentials.use().suspend()
  return React.useCallback(
    (request, serviceName) => {
      const signer = new SignerV4(request, serviceName)
      signer.addAuthorization(credentials, new Date())
    },
    [credentials],
  )
}

export const useS3Signer = ({ urlExpiration = DEFAULT_URL_EXPIRATION } = {}) => {
  Credentials.use().suspend()
  const s3 = S3.use()
  return React.useCallback(
    ({ bucket, key, version }) =>
      s3.getSignedUrl('getObject', {
        Bucket: bucket,
        Key: key,
        VersionId: version,
        Expires: urlExpiration,
      }),
    [s3, urlExpiration],
  )
}

/*
Resource.Pointer handling / signing:

------------------+------------+-------------------+--------------------------+
context           | "web" urls | s3:// urls        | paths                    |
------------------+------------+-------------------+--------------------------+
MDImg             | as is      | parsed, signed,   | considered an s3 url     |
                  |            | relative to the   |                          |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
MDLink            | as is      | parsed, signed,   | as is (relative to the   |
                  |            | relative to the   | current web UI URL)      |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
Summary           | as is      | parsed, signed,   | considered an s3 url     |
                  |            | relative to the   |                          |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
Spec              | as is      | parsed, signed,   | considered an s3 url     |
                  |            | relative to the   |                          |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
*/
export const useResourceSigner = ({ urlExpiration = DEFAULT_URL_EXPIRATION } = {}) => {
  const sign = useS3Signer({ urlExpiration })
  return React.useCallback(
    ({ ctx, ptr }) =>
      Resource.Pointer.case(
        {
          Web: (url) => url,
          S3: ({ bucket, key, version }) =>
            sign({
              bucket: bucket || ctx.handle.bucket,
              key,
              version,
            }),
          S3Rel: (path) =>
            sign({
              bucket: ctx.handle.bucket,
              key: resolveKey(ctx.handle.key, path),
            }),
          Path: (path) =>
            Resource.ContextType.case(
              {
                MDLink: () => path,
                _: () =>
                  sign({
                    bucket: ctx.handle.bucket,
                    key: resolveKey(ctx.handle.key, path),
                  }),
              },
              ctx.type,
            ),
        },
        ptr,
      ),
    [sign],
  )
}

const Ctx = React.createContext()

export const Provider = composeComponent(
  'AWS.Signer.Provider',
  setPropTypes({
    urlExpiration: PT.number,
  }),
  ({ children, urlExpiration }) => (
    <Ctx.Provider value={{ urlExpiration }}>{children}</Ctx.Provider>
  ),
)

export const useSigner = () => {
  const { urlExpiration } = React.useContext(Ctx)
  return {
    signRequest: useRequestSigner(),
    getSignedS3URL: useS3Signer({ urlExpiration }),
    signResource: useResourceSigner({ urlExpiration }),
  }
}

export const use = useSigner

export const inject = (prop = 'signer') =>
  composeHOC('AWS.Signer.inject', (Component) => (props) => {
    const signer = use()
    return <Component {...{ ...props, [prop]: signer }} />
  })

export const Inject = ({ children }) => children(use())

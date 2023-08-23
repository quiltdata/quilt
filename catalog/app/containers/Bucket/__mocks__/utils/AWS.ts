import * as Model from 'model'

export const Signer = {
  useDownloadUrl: (l: Model.S3.S3ObjectLocation) => JSON.stringify(l),
}

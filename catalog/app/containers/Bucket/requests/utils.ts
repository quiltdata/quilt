import * as R from 'ramda'

export const decodeS3Key = R.pipe(R.replace(/\+/g, ' '), decodeURIComponent)

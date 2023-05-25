import * as React from 'react'

export interface Src {
  bucket: string
  packageHandle?: { name: string; hashOrTag: string }
  s3Path?: string
}

export default function useSource(
  srcBucket: string,
  srcName: string,
  hashOrTag: string,
  path: string,
): Src {
  return React.useMemo(
    () => ({
      bucket: srcBucket,
      packageHandle: srcName && hashOrTag ? { name: srcName, hashOrTag } : undefined,
      s3Path: path,
    }),
    [srcBucket, srcName, hashOrTag, path],
  )
}

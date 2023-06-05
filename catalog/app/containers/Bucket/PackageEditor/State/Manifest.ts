import * as React from 'react'
import * as R from 'ramda'

import L from 'constants/loading'
import AsyncResult from 'utils/AsyncResult'

import { Manifest, useManifest as useFetchManifest } from '../../PackageDialog/Manifest'

import type { Src } from './Source'

// TODO: move to ../io/manifest.ts
//       it means you need to decouple from `State.Src`
export default function useManifest(src: Src): Manifest | typeof L | undefined {
  const manifestData = useFetchManifest({
    bucket: src.bucket,
    name: src.packageHandle!.name,
    hashOrTag: src.packageHandle?.hashOrTag,
    pause: !src.packageHandle?.name,
  })
  return React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: R.identity,
          _: () => L,
        },
        src.packageHandle ? manifestData.result : AsyncResult.Ok(),
      ),
    [manifestData.result, src.packageHandle],
  )
}

import * as React from 'react'

import assertNever from 'utils/assertNever'

import type { ChangePhysicalKey } from './comparePackageEntries'

import FromTo from './FromTo'

interface MovedProps {
  physicalKey: Extract<ChangePhysicalKey, { _tag: 'moved' }>
}

function Moved({ physicalKey: { changed } }: MovedProps) {
  const changes = React.useMemo(
    () => changed.map(({ bucket, key }) => `s3://${bucket}/${key}`) as [string, string],
    [changed],
  )
  return (
    <>
      S3 object moved: <FromTo changes={changes} />
    </>
  )
}

interface PhysicalKeyChangedHandlerProps {
  physicalKey: NonNullable<ChangePhysicalKey>
  ignoreVersionChange: boolean
}

export default function PhysicalKeyChangedHandler({
  ignoreVersionChange,
  physicalKey,
}: PhysicalKeyChangedHandlerProps) {
  switch (physicalKey._tag) {
    case 'unmodified':
      return null
    case 'version':
      return !ignoreVersionChange ? <>S3 object version changed</> : null
    case 'moved':
      return <Moved physicalKey={physicalKey} />
    default:
      assertNever(physicalKey)
  }
}

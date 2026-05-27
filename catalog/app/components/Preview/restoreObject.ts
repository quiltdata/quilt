import * as React from 'react'

import type * as Model from 'model'
import * as GQL from 'utils/GraphQL'

import {
  type RestoreObjectResult,
  type GlacierTier,
  RestoreAlreadyInProgressError,
  GlacierExpeditedUnavailableError,
  RestoreAccessDeniedError,
  ObjectNotArchivedError,
} from 'containers/Bucket/requests/object'
import { GlacierRestoreTier } from 'model/graphql/types.generated'

import RESTORE_OBJECT from './gql/RestoreObject.generated'

type MutationData = GQL.DataForDoc<typeof RESTORE_OBJECT>

export function interpretRestoreResult(data: MutationData): RestoreObjectResult {
  const r = data.restoreObject
  switch (r.__typename) {
    case 'RestoreObjectSuccess':
      return { alreadyRestored: r.alreadyRestored }
    case 'OperationError':
      switch (r.name) {
        case 'RestoreAlreadyInProgress':
          throw new RestoreAlreadyInProgressError()
        case 'GlacierExpeditedUnavailable':
          throw new GlacierExpeditedUnavailableError()
        case 'RestoreAccessDenied':
          throw new RestoreAccessDeniedError()
        case 'InvalidObjectState':
          throw new ObjectNotArchivedError()
        default:
          throw new Error(r.message || r.name)
      }
    case 'InvalidInput':
      throw new Error(r.errors[0]?.message || 'Invalid input')
    default:
      return r // exhaustive: never
  }
}

interface UseRestoreObjectArgs {
  handle: Model.S3.S3ObjectLocation
  tier: GlacierTier
  days: number
}

const TIER_TO_ENUM: Record<GlacierTier, GlacierRestoreTier> = {
  Standard: GlacierRestoreTier.STANDARD,
  Bulk: GlacierRestoreTier.BULK,
  Expedited: GlacierRestoreTier.EXPEDITED,
}

export function useRestoreObject() {
  const runRestore = GQL.useMutation(RESTORE_OBJECT)
  return React.useCallback(
    async ({
      handle,
      tier,
      days,
    }: UseRestoreObjectArgs): Promise<RestoreObjectResult> => {
      const data = await runRestore({
        bucket: handle.bucket,
        key: handle.key,
        version: handle.version ?? null,
        tier: TIER_TO_ENUM[tier],
        days,
      })
      return interpretRestoreResult(data)
    },
    [runRestore],
  )
}

import * as React from 'react'

import type * as Model from 'model'
import * as GQL from 'utils/GraphQL'

import type { GlacierTier } from 'utils/glacier'
import { GlacierRestoreTier } from 'model/graphql/types.generated'

import RESTORE_OBJECT from './gql/RestoreObject.generated'

type MutationData = GQL.DataForDoc<typeof RESTORE_OBJECT>

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

// Returns the raw mutation union; the caller branches on __typename (see
// RehydrateDialog). Transport/network failures reject as usual.
export function useRestoreObject() {
  const runRestore = GQL.useMutation(RESTORE_OBJECT)
  return React.useCallback(
    async ({
      handle,
      tier,
      days,
    }: UseRestoreObjectArgs): Promise<MutationData['restoreObject']> => {
      const data = await runRestore({
        bucket: handle.bucket,
        key: handle.key,
        version: handle.version ?? null,
        tier: TIER_TO_ENUM[tier],
        days,
      })
      return data.restoreObject
    },
    [runRestore],
  )
}

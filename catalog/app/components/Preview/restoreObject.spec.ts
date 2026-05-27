import { describe, it, expect, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import {
  RestoreAlreadyInProgressError,
  GlacierExpeditedUnavailableError,
  RestoreAccessDeniedError,
  ObjectNotArchivedError,
} from 'containers/Bucket/requests/object'

import { interpretRestoreResult } from './restoreObject'

const success = (alreadyRestored: boolean) => ({
  __typename: 'Mutation' as const,
  restoreObject: { __typename: 'RestoreObjectSuccess' as const, alreadyRestored },
})

const opError = (name: string) => ({
  __typename: 'Mutation' as const,
  restoreObject: { __typename: 'OperationError' as const, name, message: name },
})

describe('components/Preview/restoreObject/interpretRestoreResult', () => {
  it('returns alreadyRestored=false for a new restore', () => {
    expect(interpretRestoreResult(success(false))).toEqual({ alreadyRestored: false })
  })

  it('returns alreadyRestored=true when already restored', () => {
    expect(interpretRestoreResult(success(true))).toEqual({ alreadyRestored: true })
  })

  it('throws RestoreAlreadyInProgressError', () => {
    expect(() => interpretRestoreResult(opError('RestoreAlreadyInProgress'))).toThrow(
      RestoreAlreadyInProgressError,
    )
  })

  it('throws GlacierExpeditedUnavailableError', () => {
    expect(() => interpretRestoreResult(opError('GlacierExpeditedUnavailable'))).toThrow(
      GlacierExpeditedUnavailableError,
    )
  })

  it('throws RestoreAccessDeniedError', () => {
    expect(() => interpretRestoreResult(opError('RestoreAccessDenied'))).toThrow(
      RestoreAccessDeniedError,
    )
  })

  it('throws ObjectNotArchivedError for InvalidObjectState', () => {
    expect(() => interpretRestoreResult(opError('InvalidObjectState'))).toThrow(
      ObjectNotArchivedError,
    )
  })

  it('throws a generic error for unknown OperationError names', () => {
    expect(() => interpretRestoreResult(opError('Whatever'))).toThrow(/Whatever/)
  })

  it('throws with the first InvalidInput message', () => {
    expect(() =>
      interpretRestoreResult({
        __typename: 'Mutation',
        restoreObject: {
          __typename: 'InvalidInput',
          errors: [
            {
              __typename: 'InputError',
              name: 'DaysOutOfRange',
              path: 'days',
              message: 'bad days',
            },
          ],
        },
      }),
    ).toThrow(/bad days/)
  })
})

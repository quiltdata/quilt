import * as React from 'react'
import * as urql from 'urql'
import * as GraphCache from '@urql/exchange-graphcache'
import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'
import { delay, filter, fromValue, mergeMap, pipe } from 'wonka'

import schema from 'model/graphql/schema.generated'

import * as PackageLock from '.'

vi.mock('constants/config', () => ({ default: {} }))

const LOCK = {
  __typename: 'PackageLock',
  hash: 'h',
  lockedAt: '2026-01-01T00:00:00Z',
  lockedBy: 'admin',
  reason: null,
}

const UNLOCK = urql.gql`
  mutation ($bucket: String!, $name: String!) {
    packageUnlock(bucket: $bucket, name: $name) {
      __typename
    }
  }
`

const packageFields = (op: urql.Operation): string[] =>
  (op.query.definitions[0] as any).selectionSet.selections[0].selectionSet.selections.map(
    (f: any) => (f.alias ?? f.name).value,
  )

const isLockQuery = (op: urql.Operation) => packageFields(op).includes('latest')

// Answers every query from `server`, each after `latency(op)` ms, so the two lock
// queries can resolve in either order.
function setup(latency: (op: urql.Operation) => number) {
  const server = { lock: null as typeof LOCK | null }
  const requests: string[] = []

  const answer = (op: urql.Operation) => {
    if (op.kind === 'mutation') {
      return { packageUnlock: { __typename: 'Ok' } }
    }
    const fields = packageFields(op)
    const pkg: Record<string, unknown> = {
      __typename: 'Package',
      bucket: 'b',
      name: 'team/ds',
    }
    if (fields.includes('lock')) pkg.lock = server.lock
    if (fields.includes('latest')) {
      pkg.latest = { __typename: 'PackageRevision', hash: 'h', modified: '2026-01-01' }
    }
    return { package: pkg }
  }

  const fetchExchange: urql.Exchange = () => (ops$) =>
    pipe(
      ops$,
      filter((op) => op.kind !== 'teardown'),
      mergeMap((op) => {
        requests.push(op.kind === 'query' && isLockQuery(op) ? 'Lock' : op.kind)
        return pipe(
          fromValue(urql.makeResult(op, { data: answer(op) })),
          delay(latency(op)),
        )
      }),
    )

  const client = urql.createClient({
    url: '/graphql',
    exchanges: [
      GraphCache.cacheExchange({
        schema: schema as any,
        keys: {
          Package: (p: any) => `${p.bucket}/${p.name}`,
          PackageLock: () => null,
          PackageRevision: (r: any) => `${r.hash}:${r.modified}`,
          Ok: () => null,
        },
        updates: {
          Mutation: {
            packageUnlock: (_r, { bucket, name }, cache) => {
              cache.invalidate({ __typename: 'Package', bucket, name }, 'lock')
            },
          },
        },
      }),
      fetchExchange,
    ],
  })

  const wrapper = ({ children }: React.PropsWithChildren<{}>) => (
    <urql.Provider value={client}>{children}</urql.Provider>
  )
  const statuses: [PackageLock.Status, PackageLock.Status][] = []
  const hook = renderHook(
    () => {
      const both = [
        PackageLock.useLock('b', 'team/ds').status,
        PackageLock.useLockStatus('b', 'team/ds'),
      ] as [PackageLock.Status, PackageLock.Status]
      statuses.push(both)
      return both
    },
    { wrapper },
  )
  return { client, hook, requests, server, statuses }
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await vi.advanceTimersByTimeAsync(50)
  })

describe('utils/PackageLock with Graphcache', () => {
  it.each([
    ['Lock answers first', (op: urql.Operation) => (isLockQuery(op) ? 10 : 30)],
    ['LockState answers first', (op: urql.Operation) => (isLockQuery(op) ? 30 : 10)],
  ])(
    'both hooks settle on the new lock after it is invalidated, %s',
    async (_label, latency) => {
      vi.useFakeTimers()
      try {
        const { client, hook, requests, server } = setup(latency)
        await settle()
        expect(hook.result.current).toEqual(['unlocked', 'unlocked'])

        server.lock = LOCK
        requests.length = 0
        await act(async () => {
          client.mutation(UNLOCK, { bucket: 'b', name: 'team/ds' }).toPromise()
        })
        await settle()

        expect(hook.result.current).toEqual(['locked', 'locked'])
        // One refetch per query: a partial read of the shared lock would ask again.
        expect(requests.filter((r) => r === 'Lock')).toHaveLength(1)
        expect(requests.filter((r) => r === 'query')).toHaveLength(1)
      } finally {
        vi.useRealTimers()
      }
    },
  )
})

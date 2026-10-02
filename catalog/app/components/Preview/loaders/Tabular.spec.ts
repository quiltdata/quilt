import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { apiGatewayEndpoint: '' } }))

import { loadTabularData } from './Tabular'

const handle = { bucket: 'b', key: 'k.h5ad' }

function load(info: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response('', { headers: { 'x-quilt-info': JSON.stringify(info) } }),
    ),
  )
  return loadTabularData({ handle, sign: () => 'signed', type: 'h5ad', size: 'large' })
}

describe('components/Preview/loaders/Tabular', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes the lambda meta_only flag through', async () => {
    expect((await load({ meta_only: true, truncated: false })).metaOnly).toBe(true)
  })

  it('treats a missing meta_only as a full table', async () => {
    expect((await load({ truncated: false })).metaOnly).toBe(false)
  })
})

import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import Wrapper from './Athena'

const athenaCredentials = { sentinel: 'athena-creds' }
const providerSpy = vi.fn()

vi.mock('components/Placeholder', () => ({
  default: () => <div data-testid="placeholder" />,
}))

vi.mock('utils/AWS', () => ({
  Credentials: {
    useAthenaCredentials: () => athenaCredentials,
  },
  Athena: {
    Provider: ({
      children,
      credentials,
    }: {
      children: React.ReactNode
      credentials?: unknown
    }) => {
      providerSpy(credentials)
      return <div data-testid="athena-provider">{children}</div>
    },
  },
}))

vi.mock('utils/BucketPreferences', () => ({
  use: () => ({ prefs: { tag: 'ok' } }),
  Result: {
    match: ({
      Ok,
    }: {
      Ok: (value: { ui: { athena: Record<string, never> } }) => React.ReactNode
    }) => Ok({ ui: { athena: {} } }),
  },
}))

vi.mock('./model', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="model-provider">{children}</div>
  ),
  use: () => ({
    bucket: 'bucket',
    queryExecutionId: null,
    workgroup: { data: null },
  }),
  hasData: () => false,
}))

vi.mock('./Workgroups', () => ({
  default: () => <div data-testid="workgroups" />,
}))

vi.mock('./QueryEditor', () => ({
  Form: () => <div data-testid="query-editor" />,
}))

vi.mock('./History', () => ({
  default: () => <div data-testid="history" />,
}))

vi.mock('./Results', () => ({
  default: () => <div data-testid="results" />,
}))

describe('containers/Bucket/Queries/Athena/Athena', () => {
  afterEach(() => {
    cleanup()
    providerSpy.mockClear()
  })

  it('passes Athena-scoped credentials into the Athena provider', () => {
    const { getByTestId } = render(<Wrapper />)

    expect(getByTestId('athena-provider')).toBeTruthy()
    expect(providerSpy).toHaveBeenCalledWith(athenaCredentials)
  })
})

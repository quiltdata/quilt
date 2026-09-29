import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { queriesAthenaExecution } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import History from './History'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('containers/Notifications', () => ({ use: () => ({ push: vi.fn() }) }))

// Keep the real Model helpers (hasValue, etc.); stub only `use`.
vi.mock('./model', async () => {
  const utils = await vi.importActual<object>('./model/utils')
  return {
    ...utils,
    use: () => ({
      workgroup: { data: 'primary' },
      queryBody: { setValue: vi.fn() },
    }),
  }
})

const execution = {
  id: 'exec-1',
  query: 'SELECT 1',
  status: 'SUCCEEDED',
  created: new Date('2026-01-01'),
  completed: new Date('2026-01-01'),
}

function executionHref(entry: string): string | null {
  const { container } = render(
    <MemoryRouter initialEntries={[entry]}>
      <NamedRoutes.Provider routes={{ queriesAthenaExecution }}>
        <History executions={[execution]} />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
  return container.querySelector('a')?.getAttribute('href') ?? null
}

describe('containers/Queries/Athena/History', () => {
  afterEach(cleanup)

  it('keeps the bucket scope on the link to an execution', () => {
    expect(executionHref('/queries/athena/primary?bucket=my-bucket')).toBe(
      '/queries/athena/primary/exec-1?bucket=my-bucket',
    )
  })

  // The editor on an execution route is populated from that execution's own SQL,
  // which TabulatorTables' `?table=` autofill would overwrite with an unrelated
  // SELECT.
  it('does not forward ?table= to an execution', () => {
    expect(executionHref('/queries/athena/primary?bucket=my-bucket&table=drugs')).toBe(
      '/queries/athena/primary/exec-1?bucket=my-bucket',
    )
  })
})

import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'
import { queriesAthenaExecution } from 'constants/routes'

import History from './History'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('containers/Notifications', () => ({ use: () => ({ push: vi.fn() }) }))

// Keep the real Model helpers (hasValue, etc.); stub only `use`.
vi.mock('./model', async () => {
  const utils = await vi.importActual<object>('./model/utils')
  return { ...utils, use: () => ({ workgroup: { data: 'primary' }, queryBody: {} }) }
})

const succeeded = {
  id: 'exec-1',
  status: 'SUCCEEDED',
  query: 'SELECT 1',
  created: new Date(0),
  completed: new Date(0),
}

function renderHistory(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <NamedRoutes.Provider routes={{ queriesAthenaExecution }}>
        <History executions={[succeeded] as never} />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Queries/Athena/History', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps the ?bucket= scope on an execution row link', () => {
    // The console branches on ?bucket=, so a bare pathname here remounts the
    // whole screen and drops the bucket's preferences.
    const { container } = renderHistory('/queries/athena/primary?bucket=my-bucket')
    const href = container.querySelector('a')?.getAttribute('href')
    expect(href).toBe('/queries/athena/primary/exec-1?bucket=my-bucket')
  })

  it('adds no query string when the console has no scope', () => {
    const { container } = renderHistory('/queries/athena/primary')
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '/queries/athena/primary/exec-1',
    )
  })
})

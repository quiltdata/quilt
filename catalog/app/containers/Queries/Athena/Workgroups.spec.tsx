import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import noop from 'utils/noop'

import Workgroups from './Workgroups'
import * as Model from './model'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/NamedRoutes', () => ({ use: () => ({ urls: {} }) }))

describe('containers/Queries/Athena/Workgroups', () => {
  it('names the workgroup select by its label and value', () => {
    const state = {
      queryRun: undefined,
      workgroup: Model.wrapData('primary', noop),
      workgroups: Model.wrapData({ list: ['primary'] }, noop),
    } as unknown as Model.State
    const { getByRole } = render(
      <MemoryRouter>
        <Model.Ctx.Provider value={state}>
          <Workgroups />
        </Model.Ctx.Provider>
      </MemoryRouter>,
    )
    expect(getByRole('button', { name: 'Select workgroup primary' })).toBeTruthy()
  })
})

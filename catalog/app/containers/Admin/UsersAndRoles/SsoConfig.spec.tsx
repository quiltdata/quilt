import * as React from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { cleanup, render } from '@testing-library/react'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({ admin: { ssoConfig: { text: 'roles: {}' } } }),
  useMutation: () => vi.fn(),
}))

// The editor's yaml mode is a separate chunk. Held here forever, so the test asks
// the only question that matters: does the dialog stay usable while it loads?
vi.mock('components/FileEditor/loader', () => ({
  loadMode: () => {
    throw new Promise<void>(() => {})
  },
}))

vi.mock('components/FileEditor/TextEditor', () => ({ default: () => <div /> }))

import SsoConfig from './SsoConfig'

const theme = createMuiTheme()

const renderDialog = () =>
  render(
    <ThemeProvider theme={theme}>
      <SsoConfig close={vi.fn()} />
    </ThemeProvider>,
  )

describe('containers/Admin/UsersAndRoles/SsoConfig', () => {
  afterEach(cleanup)

  // Suspending on the mode alongside the config query put the whole dialog behind
  // the skeleton -- and because the discarded render tore down the uncommitted
  // query, the retry re-issued it and never settled. The mode load belongs under
  // the editor's own boundary.
  it('stays usable while the editor mode loads', () => {
    const { queryByText } = renderDialog()
    expect(queryByText('Save')).toBeTruthy()
    expect(queryByText('Cancel')).toBeTruthy()
    expect(queryByText('Delete mapping')).toBeTruthy()
  })

  // CONTROL: the title renders either way, so it must not be what the test above
  // is really asserting.
  it('CONTROL: titles the dialog', () => {
    const { queryByText } = renderDialog()
    expect(queryByText('SSO role mapping')).toBeTruthy()
  })
})

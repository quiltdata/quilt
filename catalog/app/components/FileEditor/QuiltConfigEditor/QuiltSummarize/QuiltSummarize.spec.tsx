import * as React from 'react'
import { render } from '@testing-library/react'
import { createMuiTheme } from '@material-ui/core'
import { describe, it, expect, vi } from 'vitest'

import noop from 'utils/noop'

import QuiltSummarize from './QuiltSummarize'

const theme = createMuiTheme()

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ bucket: 'b', key: 'k' }),
  useLocation: () => ({ search: '?edit=true' }),
}))

vi.mock('utils/GlobalDialogs', () => ({
  use: () => noop,
}))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  Divider: () => <div id="divider" />,
  Button: ({ children }: { children: React.ReactNode }) => (
    <div id="button">{children}</div>
  ),
  IconButton: ({ children }: { children: React.ReactNode }) => (
    <div id="icon-button">{children}</div>
  ),
  Icon: ({ children }: { children: React.ReactNode }) => <div id="icon">{children}</div>,
  TextField: ({ value }: { value: React.ReactNode }) => (
    <div id="text-field">{value}</div>
  ),
  makeStyles: (cb: any) => () => {
    const classes = typeof cb === 'function' ? cb(theme) : cb
    return Object.keys(classes).reduce(
      (acc, key) => ({
        [key]: key,
        ...acc,
      }),
      {},
    )
  },
}))

describe('QuiltSummarize', () => {
  it('Render empty placeholders', () => {
    const { container } = render(
      <QuiltSummarize className="root" error={null} onChange={noop} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('Render row', async () => {
    const quiltSummarize = `["foo.md"]`
    const { container } = render(
      <QuiltSummarize
        className="root"
        error={null}
        onChange={noop}
        initialValue={quiltSummarize}
      />,
    )
    expect(container.querySelector('#text-field')).not.toBeNull()
    expect(container.firstChild).toMatchSnapshot()
  })

  it('Render columns', async () => {
    const quiltSummarize = `[["foo.md", "bar.md"]]`
    const { container } = render(
      <QuiltSummarize
        className="root"
        error={null}
        onChange={noop}
        initialValue={quiltSummarize}
      />,
    )
    expect(container.querySelectorAll('#text-field').length).toBeGreaterThan(1)
    expect(container.firstChild).toMatchSnapshot()
  })
})

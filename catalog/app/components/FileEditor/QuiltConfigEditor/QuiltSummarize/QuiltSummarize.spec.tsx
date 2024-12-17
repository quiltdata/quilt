import * as React from 'react'
import renderer from 'react-test-renderer'
import { createMuiTheme } from '@material-ui/core'

import QuiltSummarize from './QuiltSummarize'

const theme = createMuiTheme()
const noop = () => {}

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock(
  'react-router-dom',
  jest.fn(() => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(() => ({ bucket: 'b', key: 'k' })),
    useLocation: jest.fn(() => ({ search: '?edit=true' })),
  })),
)

jest.mock(
  'utils/GlobalDialogs',
  jest.fn(() => ({
    use: () => noop,
  })),
)

jest.mock(
  '@material-ui/core',
  jest.fn(() => ({
    ...jest.requireActual('@material-ui/core'),
    Divider: jest.fn(() => <div id="divider" />),
    Button: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div id="button">{children}</div>
    )),
    IconButton: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div id="icon-button">{children}</div>
    )),
    Icon: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div id="icon">{children}</div>
    )),
    TextField: jest.fn(({ value }: { value: React.ReactNode }) => (
      <div id="text-field">{value}</div>
    )),
    makeStyles: jest.fn((cb: any) => () => {
      const classes = typeof cb === 'function' ? cb(theme) : cb
      return Object.keys(classes).reduce(
        (acc, key) => ({
          [key]: key,
          ...acc,
        }),
        {},
      )
    }),
  })),
)

describe('QuiltSummarize', () => {
  it('Render empty placeholders', () => {
    const tree = renderer
      .create(<QuiltSummarize className="root" error={null} onChange={noop} />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('Render row', async () => {
    const quiltSummarize = `["foo.md"]`
    const tree = renderer.create(
      <QuiltSummarize
        className="root"
        error={null}
        onChange={noop}
        initialValue={quiltSummarize}
      />,
    )
    // Wait until React.useEffect is resolved (it's actually immediately resolved)
    await renderer.act(
      () =>
        new Promise((resolve) => {
          const t = setInterval(() => {
            if (!tree.root.findByProps({ id: 'text-field' }).props.value) {
              clearInterval(t)
              resolve(undefined)
            }
          }, 10)
        }),
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })

  it('Render columns', async () => {
    const quiltSummarize = `[["foo.md", "bar.md"]]`
    const tree = renderer.create(
      <QuiltSummarize
        className="root"
        error={null}
        onChange={noop}
        initialValue={quiltSummarize}
      />,
    )
    // Wait until React.useEffect is resolved (it's actually immediately resolved)
    await renderer.act(
      () =>
        new Promise((resolve) => {
          const t = setInterval(() => {
            if (tree.root.findAllByProps({ id: 'text-field' }).length > 1) {
              clearInterval(t)
              resolve(undefined)
            }
          }, 10)
        }),
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

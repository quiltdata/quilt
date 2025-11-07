import * as React from 'react'
import { render } from '@testing-library/react'

import * as CodeSamples from 'containers/Bucket/CodeSamples'
import { DirHandleCreate } from 'containers/Bucket/Toolbar'

import Options from './Options'

jest.mock('constants/config', () => ({}))

jest.mock('containers/Bucket/CodeSamples', () => ({
  Quilt3List: jest.fn(() => <div />),
  Quilt3Fetch: jest.fn(() => <div />),
  CliList: jest.fn(() => <div />),
  CliFetch: jest.fn(() => <div />),
}))

jest.mock(
  'containers/Bucket/Toolbar/GetOptions',
  () =>
    ({ code }: { code: React.ReactNode }) => <>{code}</>,
)

const { Quilt3Fetch, CliFetch } = CodeSamples as jest.Mocked<typeof CodeSamples>

describe('containers/Bucket/Dir/Toolbar/Get/Options', () => {
  const props = {
    bucket: expect.any(String),
    className: expect.any(String),
    path: expect.any(String),
  }

  it('should render CodeSamples components with correct dest for nested path', () => {
    const handle = DirHandleCreate('test-bucket', 'folder/subfolder/')

    render(<Options handle={handle} />)

    expect(Quilt3Fetch).toHaveBeenCalledWith({ ...props, dest: 'subfolder' }, {})
    expect(CliFetch).toHaveBeenCalledWith({ ...props, dest: 'subfolder' }, {})
  })

  it('should render CodeSamples components with bucket as dest for root path', () => {
    const handle = DirHandleCreate('test-bucket', '')

    render(<Options handle={handle} />)

    expect(Quilt3Fetch).toHaveBeenCalledWith({ ...props, dest: 'test-bucket' }, {})
    expect(CliFetch).toHaveBeenCalledWith({ ...props, dest: 'test-bucket' }, {})
  })
})

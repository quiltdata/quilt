import * as React from 'react'
import { render } from '@testing-library/react'

import { Quilt3Fetch, CliFetch } from 'containers/Bucket/CodeSamples'
import { DirHandleCreate } from 'containers/Bucket/Toolbar'

import Options from './Options'

jest.mock('constants/config', () => ({}))

jest.mock('containers/Bucket/CodeSamples', () => ({
  Quilt3List: jest.fn(() => <></>),
  Quilt3Fetch: jest.fn(() => <></>),
  CliList: jest.fn(() => <></>),
  CliFetch: jest.fn(() => <></>),
}))

jest.mock(
  'containers/Bucket/Toolbar/GetOptions',
  () =>
    ({ code }: { code: React.ReactNode }) => <>{code}</>,
)

describe('containers/Bucket/Dir/Toolbar/Get/Options', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const props = {
    bucket: expect.any(String),
    className: expect.any(String),
    path: expect.any(String),
  }

  it('should render CodeSamples components with correct dest for nested path', () => {
    render(<Options handle={DirHandleCreate('test-bucket', 'folder/subfolder/')} />)

    expect(Quilt3Fetch).toHaveBeenCalledWith({ ...props, dest: 'subfolder' }, {})
    expect(CliFetch).toHaveBeenCalledWith({ ...props, dest: 'subfolder' }, {})
  })

  it('should render CodeSamples components with bucket as dest for root path', () => {
    render(<Options handle={DirHandleCreate('test-bucket', '')} />)

    expect(Quilt3Fetch).toHaveBeenCalledWith({ ...props, dest: 'test-bucket' }, {})
    expect(CliFetch).toHaveBeenCalledWith({ ...props, dest: 'test-bucket' }, {})
  })
})

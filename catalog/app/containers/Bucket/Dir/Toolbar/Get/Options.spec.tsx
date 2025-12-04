import * as React from 'react'
import { render } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'

import { Quilt3Fetch, CliFetch } from 'containers/Bucket/CodeSamples'
import { DirHandleCreate } from 'containers/Bucket/Toolbar'

import Options from './Options'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('containers/Bucket/CodeSamples', () => ({
  Quilt3List: vi.fn(() => <></>),
  Quilt3Fetch: vi.fn(() => <></>),
  CliList: vi.fn(() => <></>),
  CliFetch: vi.fn(() => <></>),
}))

vi.mock('containers/Bucket/Toolbar/GetOptions', () => ({
  default: ({ code }: { code: React.ReactNode }) => <>{code}</>,
}))

describe('containers/Bucket/Dir/Toolbar/Get/Options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

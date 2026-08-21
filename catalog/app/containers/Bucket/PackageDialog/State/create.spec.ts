import { act, renderHook } from '@testing-library/react-hooks'
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

import { useCreateHandler } from './create'
import type { FilesState } from './files'
import { Ready, type FormStatus } from './form'
import type { FormParams } from './params'

vi.mock('constants/config', () => ({ default: { packageRoot: '' } }))

vi.mock('utils/Logging', () => ({ default: { error: vi.fn() } }))

const constructPackage: Mock = vi.fn()
vi.mock('utils/GraphQL', () => ({ useMutation: () => constructPackage }))

const upload: Mock = vi.fn()
vi.mock('../Uploads', () => ({
  useUploads: () => ({ upload, progress: { percent: 0, total: 0, loaded: 0 } }),
}))

const PARAMS: FormParams = {
  _tag: 'ok',
  params: {
    bucket: 'dst-bucket',
    message: 'commit message',
    name: 'foo/bar',
    userMeta: { any: 'thing' },
    workflow: 'default',
  },
}

const FILES = {
  status: { _tag: 'ok' },
  value: { added: {}, deleted: {}, existing: {} },
  initial: { added: {}, deleted: {}, existing: {} },
  onChange: () => {},
} as unknown as FilesState

function useTestHandler(params: FormParams = PARAMS, files: FilesState = FILES) {
  const [formStatus, setFormStatus] = React.useState<FormStatus>(Ready)
  const { create } = useCreateHandler(params, files, setFormStatus)
  return { formStatus, create }
}

function invalidInput(errors: { path: string | null; message: string }[]) {
  return {
    packageConstruct: {
      __typename: 'InvalidInput' as const,
      errors: errors.map((e) => ({ __typename: 'InputError' as const, ...e })),
    },
  }
}

describe('containers/Bucket/PackageDialog/State/create', () => {
  beforeEach(() => {
    constructPackage.mockReset()
    upload.mockReset()
    upload.mockResolvedValue({})
  })

  it('should surface the entries error on the files field when the server rejects the write', async () => {
    constructPackage.mockResolvedValue(
      invalidInput([
        { path: 'src.entries', message: 'Entries are not compliant with the schema' },
      ]),
    )

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.create('allow'))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    expect(status.fields?.files?.message).toBe(
      'Entries are not compliant with the schema',
    )
  })

  it('should keep unattributable validation errors as the form-level error', async () => {
    constructPackage.mockResolvedValue(
      invalidInput([{ path: 'params.name', message: 'Name is taken' }]),
    )

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.create('allow'))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    expect(status.error.message).toBe('Name is taken')
    expect(status.fields).toEqual({})
  })

  it('should surface an unexpected runtime error as a generic failure', async () => {
    constructPackage.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.create('allow'))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    // Distinct from a validation rejection: no field is flagged.
    expect(status.error.message).toBe('Unexpected error: network down')
    expect(status.fields).toBeUndefined()
  })

  it('should report an upload failure without flagging any field', async () => {
    upload.mockRejectedValue(new Error('S3 is down'))

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.create('allow'))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    expect(constructPackage).not.toHaveBeenCalled()
    expect(status.error.message).toBe('Error uploading files')
  })

  it('should ask about empty files when there is nothing to push', async () => {
    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.create())

    expect(constructPackage).not.toHaveBeenCalled()
    expect(result.current.formStatus).toEqual({ _tag: 'emptyFiles' })
  })

  it('should not submit when files are invalid', async () => {
    const files = {
      ...FILES,
      status: { _tag: 'error', error: new Error('hashing') },
    } as unknown as FilesState

    const { result } = renderHook(() => useTestHandler(PARAMS, files))
    await act(() => result.current.create('allow'))

    expect(constructPackage).not.toHaveBeenCalled()
    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return
    expect(status.error.message).toBe(
      'Files must complete hashing and comply with the entries JSON schema',
    )
  })

  it('should return the package handle on success', async () => {
    constructPackage.mockResolvedValue({
      packageConstruct: {
        __typename: 'PackagePushSuccess',
        revision: { hash: 'deadbeef' },
      },
    })

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.create('allow'))

    expect(result.current.formStatus).toEqual({
      _tag: 'success',
      handle: { bucket: 'dst-bucket', name: 'foo/bar', hash: 'deadbeef' },
    })
  })
})

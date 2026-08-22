import { act, renderHook } from '@testing-library/react-hooks'
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

import { useCopyHandler } from './copy'
import { Ready, type FormStatus } from './form'
import type { FormParams } from './params'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/Logging', () => ({ default: { error: vi.fn() } }))

const promotePackage: Mock = vi.fn()
vi.mock('utils/GraphQL', () => ({ useMutation: () => promotePackage }))

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

const SRC = { bucket: 'src-bucket', name: 'foo/bar', hash: 'abc' }

function useTestHandler(params: FormParams = PARAMS) {
  const [formStatus, setFormStatus] = React.useState<FormStatus>(Ready)
  const copy = useCopyHandler(params, setFormStatus)
  return { formStatus, copy }
}

function invalidInput(errors: { path: string | null; message: string }[]) {
  return {
    packagePromote: {
      __typename: 'InvalidInput' as const,
      errors: errors.map((e) => ({ __typename: 'InputError' as const, ...e })),
    },
  }
}

describe('containers/Bucket/PackageDialog/State/copy', () => {
  beforeEach(() => {
    promotePackage.mockReset()
  })

  it('should surface per-field errors when the server rejects the write', async () => {
    promotePackage.mockResolvedValue(
      invalidInput([
        { path: 'params.name', message: 'Name is taken' },
        { path: 'params.message', message: 'Message is required' },
        { path: 'params.userMeta', message: 'Metadata is not compliant with the schema' },
        { path: 'params.workflow', message: 'Workflow is unknown' },
      ]),
    )

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.copy(SRC, null))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    expect(status.fields?.name?.message).toBe('Name is taken')
    expect(status.fields?.message?.message).toBe('Message is required')
    expect(status.fields?.userMeta?.message).toBe(
      'Metadata is not compliant with the schema',
    )
    expect(status.fields?.workflow?.message).toBe('Workflow is unknown')
  })

  it('should keep unattributable validation errors as the form-level error', async () => {
    promotePackage.mockResolvedValue(
      invalidInput([{ path: 'params.somethingElse', message: 'Nope' }]),
    )

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.copy(SRC, null))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    expect(status.error.message).toBe('Nope')
    expect(status.fields).toEqual({})
  })

  it('should surface an unexpected runtime error as a generic failure', async () => {
    promotePackage.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.copy(SRC, null))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    // Distinct from a validation rejection: no field is flagged.
    expect(status.error.message).toBe('Unexpected error: network down')
    expect(status.fields).toBeUndefined()
  })

  it('should surface an operation error without flagging any field', async () => {
    promotePackage.mockResolvedValue({
      packagePromote: { __typename: 'OperationError', message: 'Bucket is read-only' },
    })

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.copy(SRC, null))

    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return

    expect(status.error.message).toBe('Bucket is read-only')
    expect(status.fields).toBeUndefined()
  })

  it('should not call the mutation when params are invalid', async () => {
    const { result } = renderHook(() =>
      useTestHandler({ _tag: 'invalid', error: new Error('Valid name required') }),
    )
    await act(() => result.current.copy(SRC, null))

    expect(promotePackage).not.toHaveBeenCalled()
    const status = result.current.formStatus
    expect(status._tag).toBe('error')
    if (status._tag !== 'error') return
    expect(status.error.message).toBe('Valid name required')
  })

  it('should return the package handle on success', async () => {
    promotePackage.mockResolvedValue({
      packagePromote: {
        __typename: 'PackagePushSuccess',
        revision: { hash: 'deadbeef' },
      },
    })

    const { result } = renderHook(() => useTestHandler())
    await act(() => result.current.copy(SRC, null))

    expect(result.current.formStatus).toEqual({
      _tag: 'success',
      handle: { bucket: 'dst-bucket', name: 'foo/bar', hash: 'deadbeef' },
    })
  })
})

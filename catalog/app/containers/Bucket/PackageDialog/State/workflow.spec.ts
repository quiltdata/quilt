import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import noop from 'utils/noop'
import * as workflows from 'utils/workflows'

import { Err, Ready } from './form'
import type { ManifestStatus } from './manifest'
import { useWorkflow, type WorkflowsConfigStatus } from './workflow'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/AWS', () => ({ S3: { use: noop } }))

vi.mock('../../requests', () => ({ workflowsConfig: noop }))

const MANIFEST = { _tag: 'idle' } as unknown as ManifestStatus

const CONFIG: WorkflowsConfigStatus = {
  _tag: 'ready',
  config: { ...workflows.nullConfig, isWorkflowRequired: false },
}

describe('containers/Bucket/PackageDialog/State/workflow', () => {
  describe('useWorkflow', () => {
    it('should be ok when the form has no error', () => {
      const { result } = renderHook(() => useWorkflow(Ready, MANIFEST, CONFIG))
      expect(result.current.status._tag).toBe('ok')
    })

    it('should surface the workflow error reported by the server', () => {
      const form = Err(new Error('Something went wrong'), {
        workflow: new Error('Workflow is unknown'),
      })

      const { result } = renderHook(() => useWorkflow(form, MANIFEST, CONFIG))

      expect(result.current.status).toEqual({
        _tag: 'error',
        error: new Error('Workflow is unknown'),
      })
    })

    it('should not flag the workflow for errors belonging to other fields', () => {
      const form = Err(new Error('Something went wrong'), {
        name: new Error('Name is taken'),
      })

      const { result } = renderHook(() => useWorkflow(form, MANIFEST, CONFIG))

      expect(result.current.status._tag).toBe('ok')
    })
  })
})

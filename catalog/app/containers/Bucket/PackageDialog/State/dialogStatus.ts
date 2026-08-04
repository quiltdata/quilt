import type { FormStatus } from './form'
import type { ManifestStatus } from './manifest'
import type { WorkflowsConfigStatus } from './workflow'
import type { DialogStatus } from './State'

interface DialogStatusDeps {
  formStatus: FormStatus
  manifest: ManifestStatus
  resolveError: Error | null
  waitingListing: boolean
  workflowsConfig: WorkflowsConfigStatus
}

export function computeDialogStatus({
  formStatus,
  manifest,
  resolveError,
  waitingListing,
  workflowsConfig,
}: DialogStatusDeps): DialogStatus {
  if (resolveError) return { _tag: 'error', error: resolveError }
  if (formStatus._tag === 'success') return { _tag: 'success', ...formStatus.handle }
  if (waitingListing) return { _tag: 'loading', waitListing: true }
  if (workflowsConfig._tag === 'loading' || manifest._tag === 'loading') {
    return { _tag: 'loading', waitListing: false }
  }
  if (workflowsConfig._tag === 'error') {
    return { _tag: 'error', error: workflowsConfig.error }
  }
  return { _tag: 'ready' }
}

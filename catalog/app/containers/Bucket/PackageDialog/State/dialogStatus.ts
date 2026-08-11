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
  // A failed manifest deliberately keeps rendering the form: it is reachable
  // mid-session (see the "load and revise it" link in Inputs/Name), where replacing
  // the form would discard staged files, and permanently for oversized manifests.
  // Publishing is blocked in useParams instead, so the staged work survives.
  // Copy.tsx keeps its own ladder and does block there, because promote copies the
  // whole source and has nothing to offer once the manifest is gone.
  return { _tag: 'ready' }
}

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
  // A failed manifest deliberately keeps the form: replacing it would discard files
  // staged before the failure (reachable via "load and revise it" in Inputs/Name), and
  // oversized manifests fail every time. useParams blocks publishing instead; Copy.tsx
  // does block, since promote has nothing to offer without the manifest.
  return { _tag: 'ready' }
}

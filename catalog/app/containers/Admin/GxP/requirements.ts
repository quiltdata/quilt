// Assessment is Quilt's own reading of the product, not a compliance claim:
// the customer validates.
export type Assessment =
  | 'supported'
  | 'partial'
  | 'gap'
  | 'customer'
  | 'notEnabled'
  | 'unverified'

export type LiveCheck =
  | 'pass'
  | 'fail'
  | 'running'
  | 'missing'
  | 'unavailable'
  // the status query is in flight or failed
  | 'loading'
  | 'unknown'

export interface Requirement {
  id: string
  anchor: string
  requirement: string
  control: string
  evidence: string
  assessment: Assessment
  // Synthetics canary name without the stack's canary_prefix.
  canary?: string
}

export const REQUIREMENTS: Requirement[] = [
  {
    id: 'IQ-1',
    anchor: 'GAMP 5 · IQ',
    requirement: 'System is installed as specified',
    control: 'CloudFormation parameters and outputs captured in status reports',
    evidence: 'Status report › Installation Qualification',
    assessment: 'partial',
  },
  {
    id: 'OQ-1',
    anchor: 'GAMP 5 · OQ · 21 CFR 11.10(d)',
    requirement: 'Users can access only buckets they are allowed to',
    control: 'Role-based bucket access',
    evidence: 'Canary BucketAccessControl',
    assessment: 'supported',
    canary: 'ctlg-bucket-ac',
  },
  {
    id: 'OQ-2',
    anchor: 'GAMP 5 · OQ · ALCOA+ Original',
    requirement: 'Immutable package URIs resolve to the exact recorded content',
    control: 'Content-addressed manifests and top hashes',
    evidence: 'Canary ImmutableUris',
    assessment: 'supported',
    canary: 'ctlg-uri',
  },
  {
    id: 'OQ-3',
    anchor: 'GAMP 5 · OQ',
    requirement: 'Users can create package revisions in the catalog',
    control: 'Package creation dialog and push',
    evidence: 'Canary PackagePushUi',
    assessment: 'supported',
    canary: 'ctlg-pkg-create',
  },
  {
    id: 'OQ-4',
    anchor: 'GAMP 5 · OQ',
    requirement: 'Objects and packages are findable',
    control: 'Catalog search',
    evidence: 'Canary Search',
    assessment: 'supported',
    canary: 'ctlg-search',
  },
  {
    id: 'PQ-1',
    anchor: 'GAMP 5 · PQ',
    requirement: "System performs in the customer's process",
    control: 'Customer-defined PQ protocol',
    evidence: 'Customer PQ protocol and results',
    assessment: 'customer',
  },
  {
    id: 'DI-1',
    anchor: 'ALCOA+ Original · Accurate',
    requirement: 'Content changes are detectable by hash verification',
    control: 'Per-entry and package hashes, Package.verify (run on demand)',
    evidence: 'quilt3 verify output',
    assessment: 'partial',
  },
  {
    id: 'DI-2',
    anchor: 'ALCOA+ Attributable',
    requirement: 'Each package revision records who created it',
    control: 'None in the registry (AWS CloudTrail session name only)',
    evidence: '—',
    assessment: 'gap',
  },
  {
    id: 'AT-1',
    anchor: '21 CFR 11.10(d) · Annex 11 §12.4',
    requirement: 'Audit trail of administrative and access actions',
    control: 'Registry audit trail (Firehose → S3 → Athena), best-effort delivery',
    evidence: 'Athena workgroup <stack>-audit',
    assessment: 'partial',
  },
  {
    id: 'AT-2',
    anchor: '21 CFR 11.10(e) · Annex 11 §9',
    requirement: 'Audit trail of record changes, with reason',
    control: 'Package push, delete, lock and unlock are not audited',
    evidence: '—',
    assessment: 'gap',
  },
  {
    id: 'AT-3',
    anchor: '21 CFR 11.10(c)',
    requirement: 'Audit records are retained and protected',
    control: 'Versioned audit bucket; no Object Lock retention',
    evidence: 'Stack template',
    assessment: 'partial',
  },
  {
    id: 'RL-1',
    anchor: '21 CFR 11.10(c)',
    requirement: 'Released records can be locked against change',
    control: 'Package lock with reason (admin); unlock keeps no history',
    evidence: 'Package lock record',
    assessment: 'partial',
  },
  {
    id: 'ES-1',
    anchor: '21 CFR 11.50 · 11.70 · 11.200',
    requirement: 'Electronic signatures bound to records',
    control: 'Not provided; typically the customer QMS',
    evidence: '—',
    assessment: 'gap',
  },
  {
    id: 'CC-1',
    anchor: 'Annex 11 §10 · GAMP 5',
    requirement: 'Changes to the system are controlled and documented',
    control: 'Versioned releases with changelog and pinned component versions',
    evidence: 'Release notes, TemplateBuildMetadata stack output',
    assessment: 'partial',
  },
]

export interface CanaryLike {
  name: string
  ok: boolean | null
}

// canaries === null means status monitoring is not provisioned on this stack.
export function liveCheck(
  req: Requirement,
  canaries: readonly CanaryLike[] | null,
): LiveCheck | null {
  if (!req.canary) return null
  if (!canaries) return 'unavailable'
  const matches = canaries.filter((x) => x.name.endsWith(req.canary!))
  if (matches.length !== 1) return 'missing'
  const c = matches[0]
  if (c.ok === null) return 'running'
  return c.ok ? 'pass' : 'fail'
}

// A live-backed claim is only as good as the check behind it on this stack.
export function displayedAssessment(
  req: Requirement,
  live: LiveCheck | null,
): Assessment {
  if (live === 'missing' || live === 'unavailable') return 'notEnabled'
  if (live === 'loading' || live === 'unknown') return 'unverified'
  return req.assessment
}

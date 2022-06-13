// sync with the backend
export const MAX_POLICIES_PER_ROLE = 5

const IAM_HOME = 'https://console.aws.amazon.com/iam/home'
const ARN_ROLE_RE = /^arn:aws:iam:[^:]*:[^:]+:role\/(.+)$/
const ARN_POLICY_RE = /^arn:aws:iam:[^:]*:[^:]+:policy\/(.+)$/

export function getArnLink(arn: string) {
  const [, role] = arn.match(ARN_ROLE_RE) || []
  if (role) return `${IAM_HOME}#/roles/${role}`
  const [, policy] = arn.match(ARN_POLICY_RE) || []
  if (policy) return `${IAM_HOME}#/policies/${arn}`
  return undefined
}

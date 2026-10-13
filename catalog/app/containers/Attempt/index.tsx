import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'

import GET_ATTEMPT_QUERY from './gql/Get.generated'
import TRANSITION_MUTATION from './gql/Transition.generated'

// The only edges this page drives; `attemptTransition` refuses any other as
// a BadEdge (service edges like RUNNING are set only by the job promoter).
const NEXT_STATE: Partial<Record<string, string>> = {
  AUTHENTICATED: 'CONTEXTUALIZED',
  RESULT_READY: 'REVIEWED',
  VALIDATING: 'SUBMITTED',
  PROMOTED: 'ELIGIBLE',
}

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(4, 'auto'),
    maxWidth: 480,
    padding: t.spacing(3),
  },
}))

export default function Attempt() {
  const classes = useStyles()
  const { attemptId } = RRDom.useParams<{ attemptId: string }>()
  const result = GQL.useQuery(GET_ATTEMPT_QUERY, { id: attemptId })
  const transition = GQL.useMutation(TRANSITION_MUTATION)
  const [error, setError] = React.useState<string | null>(null)

  const attempt = result.data?.me?.attempt

  const onAdvance = React.useCallback(async () => {
    if (!attempt) return
    const to = NEXT_STATE[attempt.state]
    if (!to) return
    setError(null)
    try {
      const { attemptTransition: r } = await transition({
        input: {
          challenge: attempt.challenge,
          to: to as never,
          baseVersion: attempt.version,
        },
      })
      switch (r.__typename) {
        case 'Attempt':
          result.run({ requestPolicy: 'network-only' })
          return
        case 'InvalidInput':
          setError(r.errors.map((e) => e.message).join('; '))
          return
        default:
          assertNever(r)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `${err}`)
    }
  }, [attempt, transition, result])

  if (result.fetching) {
    return (
      <M.Paper className={classes.root}>
        <M.CircularProgress />
      </M.Paper>
    )
  }

  if (!attempt) {
    return (
      <M.Paper className={classes.root}>
        <M.Typography>This attempt doesn&apos;t exist, or isn&apos;t yours.</M.Typography>
      </M.Paper>
    )
  }

  const next = NEXT_STATE[attempt.state]

  return (
    <M.Paper className={classes.root}>
      <M.Typography variant="h5" gutterBottom>
        {attempt.challenge}
      </M.Typography>
      <M.Typography color="textSecondary" gutterBottom>
        State: {attempt.state}
      </M.Typography>
      {error && (
        <M.Typography color="error" gutterBottom>
          {error}
        </M.Typography>
      )}
      {next && (
        <M.Button variant="contained" color="primary" onClick={onAdvance}>
          Advance to {next}
        </M.Button>
      )}
    </M.Paper>
  )
}

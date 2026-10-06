import * as React from 'react'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import * as SessionPackage from 'components/Assistant/Model/SessionPackage'
import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import * as FI from 'containers/Bucket/PackageDialog/Inputs/Files/State'
import * as Uploads from 'containers/Bucket/PackageDialog/Uploads'
import PACKAGE_CONSTRUCT from 'containers/Bucket/PackageDialog/gql/PackageConstruct.generated'
import { getUsernamePrefix } from 'containers/Bucket/PackageDialog/State/name'
import * as Buckets from 'utils/Buckets'
import { useMutation } from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

type API = NonNullable<ReturnType<typeof Assistant.Model.useAssistantAPI>>

const BUCKET_KEY = 'QURATOR_SAVE_BUCKET'

const loadBucket = () => {
  try {
    return localStorage.getItem(BUCKET_KEY)
  } catch {
    return null
  }
}

async function localFile(path: string, body: string, type: string) {
  const file = FI.computeHash(new File([body], path, { type })) as FI.LocalFile
  await file.hash.promise
  return { path, file }
}

type Status =
  | { _tag: 'idle' }
  | { _tag: 'saving' }
  | { _tag: 'error'; message: string }
  | { _tag: 'saved'; bucket: string; name: string; hash: string }

// The user's click is the consent: this writes as them, through the same
// upload + `packageConstruct` path as the Create package dialog, never as a tool call.
function useSave(api: API) {
  const uploads = Uploads.useUploads()
  const construct = useMutation(PACKAGE_CONSTRUCT)
  return React.useCallback(
    async (bucket: string, name: string, includeResults: boolean): Promise<Status> => {
      const { events } = api.state
      const info = {
        model: api.model.current,
        savedAt: new Date(),
        bucket,
        includeResults,
      }
      try {
        const files = await Promise.all([
          localFile('README.md', SessionPackage.toReadme(events, info), 'text/markdown'),
          localFile(
            'transcript.md',
            SessionPackage.toTranscript(events, info),
            'text/markdown',
          ),
          localFile(
            'session.json',
            SessionPackage.toSessionJson(events, info),
            'application/json',
          ),
        ])
        const uploaded = await uploads.upload({
          files,
          bucket,
          getCanonicalKey: (path) => s3paths.canonicalKey(name, path, cfg.packageRoot),
        })
        const entries = Object.entries(uploaded).map(([logicalKey, f]) => ({
          logicalKey,
          physicalKey: f.physicalKey,
          hash: f.hash ?? null,
          meta: null,
          size: f.size ?? null,
        }))
        const { packageConstruct: r } = await construct({
          params: {
            bucket,
            name,
            message: 'Qurator session',
            userMeta: SessionPackage.toUserMeta(events, info),
            // `null` is the bucket's default workflow; `''` would be "none".
            workflow: null,
          },
          src: { entries },
        })
        switch (r.__typename) {
          case 'PackagePushSuccess':
            return { _tag: 'saved', bucket, name, hash: r.revision.hash }
          case 'OperationError':
            return { _tag: 'error', message: r.message }
          case 'InvalidInput':
            return { _tag: 'error', message: r.errors.map((e) => e.message).join('; ') }
        }
      } catch (e) {
        return { _tag: 'error', message: e instanceof Error ? e.message : String(e) }
      }
    },
    [api, uploads, construct],
  )
}

function SaveForm({ api }: { api: API }) {
  const buckets = Buckets.useRelevantBuckets()
  const { urls } = NamedRoutes.use()
  const save = useSave(api)
  const { events } = api.state
  const [bucket, setBucket] = React.useState(() => {
    const last = loadBucket()
    return buckets.find((b) => b.name === last)?.name ?? buckets[0]?.name ?? ''
  })
  const [name, setName] = React.useState('')
  const [status, setStatus] = React.useState<Status>({ _tag: 'idle' })
  const username = redux.useSelector(authSelectors.username) as string | undefined
  const empty = !events.some((e) => !e.discarded)
  const nameValue =
    name ||
    SessionPackage.defaultName(
      events,
      new Date(),
      getUsernamePrefix(username).replace(/\/$/, ''),
    )
  const foreign = SessionPackage.foreignBuckets(events, bucket)
  // Results read from another bucket would be readable by everyone who reads this one.
  const [results, setResults] = React.useState<boolean | null>(null)
  const includeResults = results ?? !foreign.length

  const onSave = async () => {
    setStatus({ _tag: 'saving' })
    try {
      localStorage.setItem(BUCKET_KEY, bucket)
    } catch {
      // Unpersisted, the choice still holds for this save.
    }
    setStatus(await save(bucket, nameValue, includeResults))
  }

  return (
    <>
      <M.Typography variant="subtitle2">Save session as package</M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        README, readable transcript and replayable <code>session.json</code>. Saving again
        adds a revision.
      </M.Typography>
      <M.TextField
        select
        size="small"
        label="Bucket"
        value={bucket}
        onChange={(e) => setBucket(e.target.value)}
        SelectProps={{ native: true }}
      >
        {buckets.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
          </option>
        ))}
      </M.TextField>
      <M.TextField
        size="small"
        label="Package name"
        value={nameValue}
        onChange={(e) => setName(e.target.value)}
      />
      {!!foreign.length && (
        <M.Typography variant="body2" color="textSecondary">
          This session also read {foreign.join(', ')}. Anyone who can read {bucket} will
          see what you save.
        </M.Typography>
      )}
      <M.FormControlLabel
        control={
          <M.Checkbox
            size="small"
            checked={includeResults}
            onChange={(e) => setResults(e.target.checked)}
          />
        }
        label="Include tool results"
      />
      <M.Button
        variant="contained"
        color="primary"
        disabled={empty || !bucket || api.busy || status._tag === 'saving'}
        onClick={onSave}
      >
        {status._tag === 'saving' ? 'Saving…' : 'Save session'}
      </M.Button>
      {status._tag === 'error' && (
        <M.Typography variant="body2" color="error">
          {status.message}
        </M.Typography>
      )}
      {status._tag === 'saved' && (
        <M.Typography variant="body2">
          Saved{' '}
          <M.Link
            component={Link}
            to={urls.bucketPackageTree(status.bucket, status.name, status.hash)}
          >
            {status.name}@{status.hash.slice(0, 8)}
          </M.Link>
        </M.Typography>
      )}
    </>
  )
}

export default function Save({ api }: { api: API }) {
  return (
    <React.Suspense fallback={<M.CircularProgress size={20} />}>
      <SaveForm api={api} />
    </React.Suspense>
  )
}

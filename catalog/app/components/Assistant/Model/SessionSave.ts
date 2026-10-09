import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'

import type * as Assistant from './Assistant'
import * as SessionPackage from './SessionPackage'
import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import * as FI from 'containers/Bucket/PackageDialog/Inputs/Files/State'
import * as Uploads from 'containers/Bucket/PackageDialog/Uploads'
import PACKAGE_CONSTRUCT from 'containers/Bucket/PackageDialog/gql/PackageConstruct.generated'
import PACKAGE_EXISTS from 'containers/Bucket/PackageDialog/gql/PackageExists.generated'
import {
  getUsernamePrefix,
  useNameExistence,
} from 'containers/Bucket/PackageDialog/State/name'
import BUCKETS_QUERY from 'utils/Buckets.generated'
import * as GQL from 'utils/GraphQL'
import * as s3paths from 'utils/s3paths'

type API = Assistant.AssistantAPI

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

export type Status =
  | { _tag: 'idle' }
  | { _tag: 'saving' }
  | { _tag: 'error'; message: string }
  | { _tag: 'saved'; bucket: string; name: string; hash: string }

// The user's click is the consent: this writes as them, through the same
// upload + `packageConstruct` path as the Create package dialog, never as a tool call.
export function useSave(api: API) {
  const uploads = Uploads.useUploads()
  const construct = GQL.useMutation(PACKAGE_CONSTRUCT)
  const client = urql.useClient()
  return React.useCallback(
    async (
      bucket: string,
      name: string,
      includeResults: boolean,
      revising: boolean,
    ): Promise<Status> => {
      // Checked again at the click, from the network: a package created at this name
      // since the form's check would otherwise lose its files to this revision.
      if (!revising) {
        const r = await client
          .query(PACKAGE_EXISTS, { bucket, name }, { requestPolicy: 'network-only' })
          .toPromise()
        if (r.error) return { _tag: 'error', message: r.error.message }
        if (r.data?.package) return { _tag: 'error', message: NAME_TAKEN }
      }
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
          // A key per save: on an unversioned bucket, reusing the key would rewrite
          // the files earlier revisions point at.
          getCanonicalKey: (path) =>
            s3paths.canonicalKey(
              name,
              `.qurator/${info.savedAt.getTime()}/${path}`,
              cfg.packageRoot,
            ),
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
        const message = e instanceof Error ? e.message : String(e)
        // The bucket list shows what the role can read; whether it can write shows up only here.
        return /AccessDenied|not authorized/i.test(message)
          ? {
              _tag: 'error',
              message: `Your current role can't write to ${bucket}. Pick another bucket, or switch workspace to one that can.`,
            }
          : { _tag: 'error', message }
      }
    },
    [api, uploads, construct, client],
  )
}

export const NAME_TAKEN = 'A package with this name exists'

export interface SessionSave {
  bucket: string
  buckets: readonly string[]
  setBucket: (b: string) => void
  name: string
  setName: (n: string) => void
  foreign: readonly string[]
  /** A call that ran named no bucket, so its results may hold any bucket's data. */
  unscoped: boolean
  includeResults: boolean
  setIncludeResults: (on: boolean) => void
  /** Why the save is unavailable right now, if it is. */
  blocked: string | null
  status: Status
  save: () => Promise<void>
}

/** Save target + action, shared by the composer's + menu and the context pane. */
export function useSessionSave(api: API): SessionSave {
  // Not the suspending bucket read: a re-suspend would unmount the chat this sits beside.
  // Same variables as `utils/Buckets`, so both share one cache entry.
  const bucketsQuery = GQL.useQuery(BUCKETS_QUERY, {
    includeCollaborators: cfg.mode === 'PRODUCT',
  })
  const buckets = React.useMemo(
    () =>
      (bucketsQuery.data?.buckets ?? [])
        .filter((b) => b.relevanceScore >= 0)
        .sort(
          (a, b) => b.relevanceScore - a.relevanceScore || a.name.localeCompare(b.name),
        ),
    [bucketsQuery.data],
  )
  const doSave = useSave(api)
  const { events } = api.state
  // Until the user picks, follow the session: saving where it worked needs no warning.
  const [picked, setPicked] = React.useState<string | null>(null)
  const listed = (b?: string | null) => buckets.find((x) => x.name === b)?.name
  const bucket =
    picked ??
    listed(SessionPackage.references(events)[0]?.bucket) ??
    listed(loadBucket()) ??
    buckets[0]?.name ??
    ''
  const [typed, setName] = React.useState('')
  const [status, setStatus] = React.useState<Status>({ _tag: 'idle' })
  const username = redux.useSelector(authSelectors.username) as string | undefined
  const empty = !events.some((e) => !e.discarded)
  const name =
    typed ||
    SessionPackage.defaultName(
      events,
      // Dated by the session's start, so a save after midnight still revises the same package.
      events.find((e) => !e.discarded)?.timestamp ?? new Date(),
      getUsernamePrefix(username).replace(/\/$/, ''),
    )
  const foreign = SessionPackage.foreignBuckets(events, bucket)
  // Results read from another bucket would be readable by everyone who reads this one,
  // so the choice is per destination.
  const unscoped = SessionPackage.unscoped(events)
  const risky = !!foreign.length || unscoped
  // A choice covers exactly what the session had read when it was made: a bucket
  // read since, or a new destination, needs asking again.
  const exposure = [bucket, unscoped ? '*' : '', ...[...foreign].sort()].join('|')
  const [choice, setChoice] = React.useState<{ on: boolean; exposure: string } | null>(
    null,
  )
  const includeResults = choice && choice.exposure === exposure ? choice.on : !risky
  const setResults = React.useCallback(
    (on: boolean | null) => setChoice(on === null ? null : { on, exposure }),
    [exposure],
  )
  const setBucket = React.useCallback((b: string) => {
    setPicked(b)
    setChoice(null)
  }, [])
  const [statusFor, setStatusFor] = React.useState('')
  const shownStatus: Status =
    (status._tag === 'saved' || status._tag === 'error') &&
    statusFor !== `${bucket}/${name}`
      ? { _tag: 'idle' }
      : status

  // A save sends only the session files, so as a revision of another package it
  // would drop that package's files; only a package this session saved may be revised.
  const [savedTo, setSavedTo] = React.useState<readonly string[]>([])
  const dst = React.useMemo(() => ({ bucket, name }), [bucket, name])
  const mine = savedTo.includes(`${bucket}/${name}`)
  const existence = useNameExistence(dst, mine ? dst : undefined)
  // A new conversation is a new package: drop what the last one typed and saved.
  const sid = SessionPackage.sessionId(events)
  // A save still in flight when a new session starts belongs to the old one.
  const sidRef = React.useRef(sid)
  sidRef.current = sid
  React.useEffect(() => {
    setName('')
    setSavedTo([])
    setChoice(null)
    setStatus({ _tag: 'idle' })
  }, [sid])

  const blocked = empty
    ? 'Ask something first'
    : !bucket
      ? bucketsQuery.fetching
        ? 'Loading buckets…'
        : 'No bucket to save to'
      : existence._tag === 'exists'
        ? NAME_TAKEN
        : existence._tag === 'error'
          ? existence.error.message
          : existence._tag !== 'new' && existence._tag !== 'new-revision'
            ? 'Checking the name…'
            : api.busy || status._tag === 'saving'
              ? 'Busy'
              : null

  const save = React.useCallback(async () => {
    setStatus({ _tag: 'saving' })
    try {
      localStorage.setItem(BUCKET_KEY, bucket)
    } catch {
      // Unpersisted, the choice still holds for this save.
    }
    const startedIn = sidRef.current
    const result = await doSave(bucket, name, includeResults, mine)
    if (sidRef.current !== startedIn) return
    // Pinned once saved: discarding the first message would otherwise derive a new name.
    if (result._tag === 'saved') setName(name)
    if (result._tag === 'saved')
      setSavedTo((s) =>
        s.includes(`${bucket}/${name}`) ? s : [...s, `${bucket}/${name}`],
      )
    setStatusFor(`${bucket}/${name}`)
    setStatus(result)
  }, [bucket, name, includeResults, doSave, mine])

  return {
    bucket,
    buckets: React.useMemo(() => buckets.map((b) => b.name), [buckets]),
    setBucket,
    name,
    setName,
    foreign,
    unscoped,
    includeResults,
    setIncludeResults: setResults,
    blocked,
    status: shownStatus,
    save,
  }
}

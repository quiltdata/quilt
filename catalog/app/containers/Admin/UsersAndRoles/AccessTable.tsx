import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

import { Grant, LEVEL_LABEL, summarize } from './access'

const WRITE = Model.GQLTypes.BucketPermissionLevel.READ_WRITE

const useSummaryStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  caveat: {
    color: t.palette.warning.dark,
  },
}))

interface SummaryProps {
  grants: readonly Grant[]
  /** Named so the empty case can say what has no access, e.g. 'This role'. */
  subject: string
  /**
   * A policy Quilt cannot read is in play, so an empty grant list means unknown, not
   * none. Not phrased as a custom role: a managed role holding a policy set by ARN
   * lands here too, and that would send an admin after the wrong thing.
   */
  unknown?: boolean
}

export function AccessSummary({ grants, subject, unknown = false }: SummaryProps) {
  const classes = useSummaryStyles()
  const s = summarize(grants)
  if (!s.buckets) {
    return (
      <M.Typography className={classes.root}>
        {unknown ? (
          <span className={classes.caveat}>
            {subject} carries an IAM policy Quilt cannot read, so its bucket access is
            unknown; check the role in the AWS console.
          </span>
        ) : (
          `${subject} reaches no bucket. Attaching a policy is what grants access.`
        )}
      </M.Typography>
    )
  }
  return (
    <M.Typography className={classes.root}>
      {s.buckets} {s.buckets === 1 ? 'bucket' : 'buckets'}: {s.write} writable, {s.read}{' '}
      read-only.
      {s.unattributed > 0 && (
        <>
          {' '}
          <span className={classes.caveat}>
            {s.unattributed} {s.unattributed === 1 ? 'is' : 'are'} granted through a
            policy Quilt does not manage, so the source cannot be shown.
          </span>
        </>
      )}
    </M.Typography>
  )
}

const useStyles = M.makeStyles((t) => ({
  table: {
    // Bucket names are machine-exact but repeat down a dense column; body type in
    // secondary ink per the carve-out in the Mono Identity Rule.
    '& td, & th': {
      whiteSpace: 'nowrap',
    },
  },
  bucket: {
    color: t.palette.text.secondary,
  },
  level: {
    fontWeight: t.typography.fontWeightMedium,
  },
  write: {
    color: t.palette.warning.dark,
  },
  sources: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    whiteSpace: 'normal',
  },
  unattributed: {
    ...t.typography.body2,
    color: t.palette.warning.dark,
    whiteSpace: 'normal',
  },
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    padding: t.spacing(2, 0),
  },
  unknownNote: {
    ...t.typography.body2,
    color: t.palette.warning.dark,
    padding: t.spacing(2, 0),
  },
}))

interface AccessTableProps {
  grants: readonly Grant[]
  /** Show which role each source came through; only meaningful across roles. */
  showRole?: boolean
  /** A policy Quilt cannot read is in play, so this readout is unknown or incomplete. */
  unknown?: boolean
}

// Reads out the access that is in force, and why. The level column is the server's
// MAX() across policies; the source column is the set of policies that add up to it,
// so revoking one is visibly not the same as revoking access.
export default function AccessTable({
  grants,
  showRole = false,
  unknown = false,
}: AccessTableProps) {
  const classes = useStyles()
  if (!grants.length)
    return (
      <div className={unknown ? classes.unknownNote : classes.empty}>
        {unknown
          ? 'An IAM policy here cannot be read by Quilt, so this access is unknown. Check the role in the AWS console.'
          : 'No bucket access.'}
      </div>
    )
  return (
    <>
      <M.Table size="small" className={classes.table}>
        <M.TableHead>
          <M.TableRow>
            <M.TableCell>Bucket</M.TableCell>
            <M.TableCell>Access</M.TableCell>
            <M.TableCell>Granted by</M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {grants.map((g) => (
            <M.TableRow key={g.bucket} hover>
              <M.TableCell className={classes.bucket}>{g.bucket}</M.TableCell>
              <M.TableCell>
                <span
                  className={`${classes.level} ${g.level === WRITE ? classes.write : ''}`}
                >
                  {LEVEL_LABEL[g.level]}
                </span>
              </M.TableCell>
              <M.TableCell>
                {g.sources.length ? (
                  <span className={classes.sources}>
                    {g.sources
                      .map(
                        (s) =>
                          `${s.title} (${LEVEL_LABEL[s.level]})${
                            showRole && s.roleName ? ` via ${s.roleName}` : ''
                          }`,
                      )
                      .join(', ')}
                  </span>
                ) : (
                  <span className={classes.unattributed}>
                    A policy Quilt does not manage
                  </span>
                )}
              </M.TableCell>
            </M.TableRow>
          ))}
        </M.TableBody>
      </M.Table>
      {unknown && (
        <div className={classes.unknownNote}>
          Some of this access is set by an IAM policy Quilt cannot read, so the list may
          be incomplete.
        </div>
      )}
    </>
  )
}

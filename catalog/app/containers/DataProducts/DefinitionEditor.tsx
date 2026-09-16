import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'

/**
 * The SQL editor, its reach, and the check.
 *
 * Shared by the creation stepper and the revise flow, because the constraints are
 * the same in both and a second copy would drift.
 *
 * Three things it deliberately does:
 *
 * - **Shows the reach beside the editor.** A SQL that names a bucket the workspace
 *   does not hold is refused before anything runs, so the buckets it may select from
 *   are worth showing before a check rather than after one fails.
 * - **Checks on an explicit press, never on keystroke.** With a real registry a
 *   check is an Athena query and costs money; a debounce would just spend it more
 *   slowly.
 * - **Says what the check does not cover.** The static checks are not the output
 *   contract: D-J is open (UNK-41), and validation proper is a `SELECT ... LIMIT 0`
 *   as the definer after the view exists in the product database — which cannot run
 *   before designation, since there is no product database yet (UNK-C4).
 *
 * There is no preview of candidate rows. Whether any run is affordable before
 * designation is exactly UNK-C4, and inventing rows would answer that open question
 * in the reader's favour while teaching sizes and hashes the definition cannot
 * produce (invariant 4: integrity facts come from the substrate at the join).
 */

const useStyles = M.makeStyles((t) => ({
  editor: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.8125rem',
  },
  reach: {
    marginTop: t.spacing(1),
  },
  errors: {
    marginTop: t.spacing(2),
  },
}))

interface Props {
  sql: string
  onChange: (sql: string) => void
  reach: string[]
}

export default function DefinitionEditor({ sql, onChange, reach }: Props) {
  const classes = useStyles()
  const { check, pending, run } = DP.useDefinitionCheck()

  return (
    <div data-testid="dp-definition-editor">
      <M.TextField
        label="Definition (SQL)"
        multiline
        rows={8}
        fullWidth
        variant="outlined"
        value={sql}
        onChange={(e) => onChange(e.target.value)}
        InputProps={{ className: classes.editor }}
      />

      <div className={classes.reach}>
        <M.Typography variant="caption" color="textSecondary" display="block">
          Your workspace&apos;s reach — the only buckets a definition may select from:
        </M.Typography>
        <M.Typography variant="caption" color="textSecondary">
          {reach.length ? reach.map((b) => `s3://${b}`).join(', ') : 'no buckets held'}
        </M.Typography>
      </div>

      <M.Box mt={2}>
        <M.Button variant="outlined" disabled={pending} onClick={() => run(sql, reach)}>
          Check
        </M.Button>
      </M.Box>

      {check && (
        <div className={classes.errors} data-testid="dp-definition-check">
          {check.valid ? (
            <M.Typography variant="body2">The static checks pass.</M.Typography>
          ) : (
            <>
              <M.Typography variant="subtitle2">The static checks found:</M.Typography>
              <ul>
                {check.errors.map((e) => (
                  <li key={e}>
                    <M.Typography variant="body2" color="textSecondary">
                      {e}
                    </M.Typography>
                  </li>
                ))}
              </ul>
            </>
          )}
          {check.referencedBuckets.length > 0 && (
            <M.Typography variant="caption" color="textSecondary" display="block">
              Selects from {check.referencedBuckets.map((b) => `s3://${b}`).join(', ')}
            </M.Typography>
          )}
          <M.Box mt={1}>
            <M.Typography variant="caption" color="textSecondary">
              These are static checks only. The definition is not run: validation is a{' '}
              <code>SELECT … LIMIT 0</code> as the definer once the view exists in the
              product database, and the full output contract is not settled yet.
            </M.Typography>
          </M.Box>
        </div>
      )}
    </div>
  )
}

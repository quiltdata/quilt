import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'

import { WriteResult } from './FixtureNotice'
import DefinitionEditor from './DefinitionEditor'

/**
 * The rule that defines the product, and revising it.
 *
 * The version note is the load-bearing copy here. A revision changes the
 * definition identity, so later mints drain the new definition while captures
 * already minted keep serving the version they were minted against until their
 * credentials expire (invariant 5, DEC-28). A save that did not say so would let a
 * publisher believe a revision reaches current readers immediately.
 *
 * The panel also names who reads this product, so the author can see who the new
 * version reaches before saving -- read from the exchange record, which only the
 * owner has.
 */

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3),
  },
  sql: {
    background: t.palette.action.hover,
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.75rem',
    marginTop: t.spacing(1),
    padding: t.spacing(1.5),
    whiteSpace: 'pre-wrap',
  },
  section: {
    marginTop: t.spacing(3),
  },
}))

export default function Definition({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const publishing = DP.usePublishing()
  const reach = DP.useWorkspaceReach()
  const [sql, setSql] = React.useState('')
  const [revising, setRevising] = React.useState(false)

  const revise = React.useCallback(
    () => (publishing ? publishing.revise(product.id, sql) : Promise.resolve(null)),
    [publishing, product.id, sql],
  )
  const save = DP.useWrite(publishing ? revise : null)

  const approved = (product.subscribers ?? []).filter((s) =>
    DP.grantIsPresent(DP.deriveState(s, 'publisher')),
  )

  const start = React.useCallback(() => {
    setSql(product.definition.sql ?? '')
    setRevising(true)
  }, [product.definition.sql])

  return (
    <div className={classes.root} data-testid="dp-definition">
      <M.Typography variant="h6">Definition</M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        {product.definition.view} · version {product.definition.versionId} · authored{' '}
        {product.definition.authoredAt.toLocaleDateString()}
      </M.Typography>

      {revising ? (
        <div className={classes.section}>
          <DefinitionEditor sql={sql} onChange={setSql} reach={reach} />
          <M.Box mt={2} display="flex" style={{ gap: 8 }}>
            <M.Button
              variant="contained"
              color="primary"
              disabled={save.pending}
              onClick={() => save.call()}
            >
              {/* The consequence is in the button, not only in the note above it:
                  the act being agreed to is "a new version", not "a save". */}
              Save as new version
            </M.Button>
            <M.Button onClick={() => setRevising(false)}>Cancel</M.Button>
          </M.Box>
          <WriteResult result={save.result} />
        </div>
      ) : (
        <>
          {product.definition.sql ? (
            <div className={classes.sql}>{product.definition.sql}</div>
          ) : (
            <M.Box mt={2}>
              <M.Typography variant="body2" color="textSecondary">
                The definition&apos;s SQL is not returned to your workspace.
              </M.Typography>
            </M.Box>
          )}
          <M.Box mt={2}>
            <M.Button variant="outlined" onClick={start}>
              Revise
            </M.Button>
          </M.Box>
        </>
      )}

      <div className={classes.section}>
        <M.Typography variant="subtitle2">Selects from</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          {product.definition.referencedBuckets.map((b) => `s3://${b}`).join(', ')}
        </M.Typography>
      </div>

      <div className={classes.section}>
        <M.Typography variant="subtitle2">What a revision does</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Revising creates a new version. Readers&apos; next mint drains the new
          definition; credentials they already hold keep serving the capture they were
          minted against until those credentials expire.
        </M.Typography>
        {approved.length > 0 && (
          <M.Box mt={1}>
            <M.Typography variant="body2" color="textSecondary">
              {approved.length === 1
                ? '1 workspace reads this product'
                : `${approved.length} workspaces read this product`}
              : {approved.map((s) => s.subscriber.name).join(', ')}.
            </M.Typography>
          </M.Box>
        )}
      </div>
    </div>
  )
}

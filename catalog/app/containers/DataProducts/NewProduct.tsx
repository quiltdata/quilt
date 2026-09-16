import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'

import DefinitionEditor from './DefinitionEditor'
import FixtureNotice, { WorkspaceSwitcher, WriteResult } from './FixtureNotice'

/**
 * The creation flow: from "I have a rule for what belongs" to a designated,
 * unpublished product.
 *
 * A stepper, with every constraint of the model said at the step where it bites
 * rather than in a preamble nobody reads:
 *
 * 1. **Name it.** Id and Title are two fields, deliberately apart, because
 *    `volume_id` is immutable and a rename is a new row (DEC-23 as amended). One
 *    "Name" field would imply otherwise, so the id carries its consequence beside
 *    it: consumers address the product as `s3://<id>/`.
 * 2. **Define it.** The SQL, the workspace's reach, and the static checks.
 * 3. **Create.** What designation actually does, then the act.
 *
 * There is no preview step. Whether any run of a draft definition is affordable
 * before designation is UNK-C4 — Fig. 4 validates *after* the view exists in the
 * product database, and before designation there is no database to run in — so the
 * step would have to invent candidate rows to exist at all.
 *
 * Designation is a five-step saga on the registry, and this stack serves none of
 * it. The act therefore reports that nothing was created, naming the steps that
 * would have run. It does not fabricate a job, a progress bar or a product: the
 * stepper's failure panel is written for a real saga, and a fake one would teach
 * that the saga exists.
 */

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3),
  },
  step: {
    marginTop: t.spacing(3),
  },
  field: {
    marginTop: t.spacing(2),
  },
  consequence: {
    marginTop: t.spacing(0.5),
  },
  saga: {
    marginTop: t.spacing(2),
  },
}))

/** S3's bucket-name rule, which a `volume_id` must satisfy. */
const ID_RULE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/

/**
 * The saga's named steps.
 *
 * Listed under the act so a publisher knows what designation does before pressing
 * it: a governed database, the owner's grant, the view, its validation, and the
 * registry row. Named rather than summarized because a failure names the step it
 * failed at, and the reader will meet these words again if one does.
 */
const SAGA_STEPS = [
  'CREATE_DATABASE',
  'GRANT_OWNER',
  'CREATE_VIEW',
  'VALIDATE',
  'REGISTER',
]

export default function NewProduct() {
  const classes = useStyles()
  const workspace = DP.useActiveWorkspace()
  const reach = DP.useWorkspaceReach()
  const publishing = DP.usePublishing()

  const [id, setId] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [sql, setSql] = React.useState('')

  const designate = React.useCallback(
    () =>
      publishing
        ? publishing.designate({ id, title, description, sql })
        : Promise.resolve(null),
    [publishing, id, title, description, sql],
  )
  const create = DP.useWrite(publishing ? designate : null)

  const idError = id && !ID_RULE.test(id)

  return (
    <div className={classes.root} data-testid="dp-new-product">
      <M.Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <M.Typography variant="h5">New data product</M.Typography>
        <WorkspaceSwitcher />
      </M.Box>

      <FixtureNotice />

      <M.Typography variant="body2" color="textSecondary">
        A data product is a rule over the substrate your workspace already holds.
        Designating it creates a governed database and a view; publishing it is a separate
        act.
      </M.Typography>

      <section className={classes.step}>
        <M.Typography variant="h6">1 · Name it</M.Typography>
        <M.TextField
          className={classes.field}
          label="Id"
          fullWidth
          variant="outlined"
          value={id}
          error={!!idError}
          helperText={
            idError
              ? 'Lowercase letters, digits and hyphens; 3–63 characters; must start and end alphanumeric.'
              : 'Cannot change once created — a rename is a new product.'
          }
          onChange={(e) => setId(e.target.value)}
        />
        {id && !idError && (
          <M.Typography
            className={classes.consequence}
            variant="caption"
            color="textSecondary"
          >
            Consumers will address this as <code>s3://{id}/</code>
          </M.Typography>
        )}
        <M.TextField
          className={classes.field}
          label="Title"
          fullWidth
          variant="outlined"
          value={title}
          helperText="Editable later."
          onChange={(e) => setTitle(e.target.value)}
        />
        <M.TextField
          className={classes.field}
          label="Description"
          fullWidth
          multiline
          rows={2}
          variant="outlined"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </section>

      <section className={classes.step}>
        <M.Typography variant="h6">2 · Define it</M.Typography>
        <M.Box mt={1}>
          <DefinitionEditor sql={sql} onChange={setSql} reach={reach} />
        </M.Box>
      </section>

      <section className={classes.step}>
        <M.Typography variant="h6">3 · Create</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Creates the product&apos;s governed database, authors the view as workspace{' '}
          {workspace}, validates it, and registers the product. Nothing is published yet.
        </M.Typography>
        <div className={classes.saga}>
          <M.Typography variant="caption" color="textSecondary" display="block">
            Designation runs as five steps, and a failure names the one it stopped at:
          </M.Typography>
          <M.Typography variant="caption" color="textSecondary">
            <code>{SAGA_STEPS.join(' · ')}</code>
          </M.Typography>
        </div>
        <M.Box mt={2}>
          <M.Button
            variant="contained"
            color="primary"
            disabled={create.pending || !id || !!idError || !title || !sql}
            onClick={() => create.call()}
          >
            Create data product
          </M.Button>
        </M.Box>
        <WriteResult result={create.result} />
      </section>
    </div>
  )
}

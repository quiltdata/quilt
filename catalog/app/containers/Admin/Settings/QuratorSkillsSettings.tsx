import * as React from 'react'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'

import QURATOR_SKILL_REMOVE_MUTATION from './gql/QuratorSkillRemove.generated'
import QURATOR_SKILL_SET_MUTATION from './gql/QuratorSkillSet.generated'
import QURATOR_SKILLS_ADMIN_QUERY from './gql/QuratorSkillsAdmin.generated'
import * as Source from './skillSource'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(2),
  },
  note: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  add: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: t.spacing(1),
  },
  url: {
    flexGrow: 1,
  },
  list: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    padding: 0,
  },
  name: {
    fontFamily: t.typography.monospace?.fontFamily ?? 'monospace',
    marginRight: t.spacing(1),
  },
  chip: {
    marginRight: t.spacing(0.5),
  },
  error: {
    ...t.typography.body2,
    color: t.palette.error.main,
  },
}))

type Result = {
  __typename: string
  errors?: readonly { message: string }[]
  message?: string
}

const failure = (r: Result) =>
  r.__typename === 'InvalidInput'
    ? (r.errors ?? []).map((e) => e.message).join(' ')
    : r.__typename === 'OperationError'
      ? (r.message ?? 'The registry refused the change')
      : null

export default function QuratorSkillsSettings() {
  const classes = useStyles()
  const query = GQL.useQuery(QURATOR_SKILLS_ADMIN_QUERY)
  const setSkill = GQL.useMutation(QURATOR_SKILL_SET_MUTATION)
  const removeSkill = GQL.useMutation(QURATOR_SKILL_REMOVE_MUTATION)

  const [url, setUrl] = React.useState('')
  const [pending, setPending] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const skills = GQL.fold(query, {
    data: (d) => d.config.quratorSkills?.skills ?? [],
    fetching: () => null,
    error: () => null,
  })
  const refresh = () => query.run({ requestPolicy: 'network-only' })

  const add = async () => {
    setError(null)
    const folder = Source.parseGitHubUrl(url)
    if (!folder) {
      setError('Paste a github.com link to a skill folder or its SKILL.md.')
      return
    }
    setPending('add')
    try {
      const files = await Source.fetchGitHubSkill(folder)
      const { admin } = await setSkill({ input: { files, source: url.trim() } })
      const problem = failure(admin.quratorSkillSet)
      if (problem) setError(problem)
      else {
        setUrl('')
        refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(null)
    }
  }

  const remove = async (name: string) => {
    setError(null)
    setPending(name)
    try {
      const { admin } = await removeSkill({ name })
      const problem = failure(admin.quratorSkillRemove)
      if (problem) setError(problem)
      else refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className={classes.root}>
      <M.Typography className={classes.note}>
        Skills are instructions Qurator follows when a question matches one. Only admins
        add or remove them; every user sees the same set and can turn each off for
        themselves.
      </M.Typography>
      <div className={classes.add}>
        <M.TextField
          className={classes.url}
          label="GitHub skill folder"
          placeholder="https://github.com/owner/repo/tree/main/skills/my-skill"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          size="small"
          variant="outlined"
          disabled={!!pending}
        />
        <M.Button
          color="primary"
          variant="outlined"
          onClick={add}
          disabled={!url.trim() || !!pending}
        >
          {pending === 'add' ? 'Adding…' : 'Add skill'}
        </M.Button>
      </div>
      {error && (
        <M.Typography className={classes.error} role="alert">
          {error}
        </M.Typography>
      )}
      {skills === null ? (
        <M.Typography className={classes.note}>
          {query.error ? "The skill list couldn't be read." : 'Loading…'}
        </M.Typography>
      ) : skills.length ? (
        <M.List className={classes.list} dense>
          {skills.map((s) => (
            <M.ListItem key={s.name} divider>
              <M.ListItemText
                primary={
                  <>
                    <span className={classes.name}>{s.name}</span>
                    <M.Chip
                      className={classes.chip}
                      size="small"
                      label={s.runClass === 'SHELL' ? 'Needs shell' : 'Guide'}
                    />
                    {!s.license && (
                      <M.Chip className={classes.chip} size="small" label="No license" />
                    )}
                  </>
                }
                secondary={
                  <>
                    {s.description}
                    {s.source && (
                      <>
                        <br />
                        {s.source}
                      </>
                    )}
                  </>
                }
              />
              <M.ListItemSecondaryAction>
                <M.Button
                  size="small"
                  onClick={() => remove(s.name)}
                  disabled={!!pending}
                  aria-label={`Remove ${s.name}`}
                >
                  {pending === s.name ? 'Removing…' : 'Remove'}
                </M.Button>
              </M.ListItemSecondaryAction>
            </M.ListItem>
          ))}
        </M.List>
      ) : (
        <M.Typography className={classes.note}>No skills yet.</M.Typography>
      )}
    </div>
  )
}

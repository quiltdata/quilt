import * as React from 'react'
import { useHistory, Link, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'

const useStyles = M.makeStyles((t) => ({
  form: {
    display: 'flex',
    marginTop: t.spacing(3),
  },
  btn: {
    marginLeft: t.spacing(2),
  },
  linkBox: {
    marginTop: t.spacing(4),
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  link: {
    display: 'block',
    padding: t.spacing(1.5, 2),
    '&:hover': {
      background: t.palette.action.hover,
    },
  },
  field: {
    ...t.typography.body1,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  name: {
    fontWeight: t.typography.fontWeightMedium,
  },
}))

export default function UriResolver({ match }) {
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const classes = useStyles()

  const uri = decodeURIComponent(match.params.uri || '')
  const [parsed, error] = React.useMemo(() => {
    try {
      return [uri ? PackageUri.parse(uri) : null]
    } catch (e) {
      return [null, e]
    }
  }, [uri])

  const [value, setValue] = React.useState(uri)

  const handleChange = React.useCallback(
    (e) => {
      setValue(e.target.value)
    },
    [setValue],
  )

  const handleSubmit = React.useCallback(
    (e) => {
      e.preventDefault()
      if (value !== uri) history.push(urls.uriResolver(value))
    },
    [value, uri, history, urls],
  )

  const to =
    parsed &&
    urls.bucketPackageTree(
      parsed.bucket,
      parsed.name,
      parsed.hash || parsed.tag,
      parsed.path,
    ) + NamedRoutes.mkSearch({ resolvedFrom: uri })

  // automatically redirect if URI is pre-filled with a correct value
  const [redirect] = React.useState(!!to)
  if (redirect) return <Redirect to={to} />

  const field = (name, val) => (
    <span className={classes.field}>
      <span className={classes.name}>{name}:</span> {val}
    </span>
  )

  return (
    <Layout
      pre={
        <M.Box pt={6} pb={4} maxWidth={'656px !important'} component={M.Container}>
          <M.Typography variant="h4" align="center">
            Resolve a Quilt package URI
          </M.Typography>

          <form className={classes.form} onSubmit={handleSubmit}>
            <M.Input
              value={value}
              onChange={handleChange}
              error={!!error}
              placeholder="Enter a URI, e.g. quilt+s3://your-bucket#package=user/package@hash"
              fullWidth
            />
            <M.Button
              className={classes.btn}
              type="submit"
              variant="contained"
              color="primary"
            >
              Resolve
            </M.Button>
          </form>

          {!!error && (
            <M.Box mt={2}>
              <M.Typography color="error">
                Error parsing URI: {error.msg || `${error}`}
              </M.Typography>
            </M.Box>
          )}
          {!!parsed && (
            <M.Paper className={classes.linkBox}>
              <Link to={to} className={classes.link}>
                {field('Registry', `s3://${parsed.bucket}`)}
                {field('Package', parsed.name)}
                {!!parsed.hash && field('Hash', parsed.hash)}
                {!!parsed.tag && field('Tag', parsed.tag)}
                {!!parsed.path && field('Path', parsed.path)}
              </Link>
            </M.Paper>
          )}
        </M.Box>
      }
    />
  )
}

import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { useHistory, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'

const useStyles = M.makeStyles((t) => ({
  container: {
    paddingTop: t.spacing(6),
    paddingBottom: t.spacing(6),
    maxWidth: '656px !important',
  },
  form: {
    display: 'flex',
    marginTop: t.spacing(3),
  },
  btn: {
    marginLeft: t.spacing(2),
  },
}))

export default function UriResolver({ match }: RouteComponentProps<{ uri: string }>) {
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const classes = useStyles()

  const uri = decodeURIComponent(match.params.uri || '')
  const [parsed, error] = React.useMemo(() => {
    try {
      return [uri ? PackageUri.parse(uri) : null]
    } catch (e) {
      return [null, e as unknown as PackageUri.PackageUriError]
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

  if (to) return <Redirect to={to} />

  return (
    <Layout
      pre={
        <M.Container className={classes.container}>
          <MetaTitle>Resolve a Quilt package URI</MetaTitle>

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
        </M.Container>
      }
    />
  )
}

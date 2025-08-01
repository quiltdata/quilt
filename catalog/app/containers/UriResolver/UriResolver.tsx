import * as React from 'react'
import { useHistory, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'
import { BaseError } from 'utils/error'

import Redirect from './Redirect'
import parsePackageUriSafe from './parsePackageUriSafe'

const useStyles = M.makeStyles((t) => ({
  container: {
    maxWidth: '656px !important',
    paddingBottom: t.spacing(2),
    paddingTop: t.spacing(2),
  },
  form: {
    display: 'flex',
    marginTop: t.spacing(3),
  },
  btn: {
    marginLeft: t.spacing(2),
  },
}))

interface FormProps {
  initialValue: string
  error: PackageUri.PackageUriError | null
}

function Form({ initialValue, error }: FormProps) {
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const classes = useStyles()

  const [value, setValue] = React.useState(initialValue)

  const handleChange = React.useCallback(
    (e) => {
      setValue(e.target.value)
    },
    [setValue],
  )

  const handleSubmit = React.useCallback(
    (e) => {
      e.preventDefault()
      if (value !== initialValue) history.push(urls.uriResolver(value))
    },
    [value, initialValue, history, urls],
  )

  return (
    <M.Container className={classes.container}>
      <MetaTitle>Resolve a Quilt+ URI</MetaTitle>

      <M.Typography variant="h4" align="center">
        Resolve a Quilt+ URI
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
          <M.Typography color="error" data-testid="uri-error">
            Error parsing URI: {error.msg || `${error}`}
          </M.Typography>
        </M.Box>
      )}
    </M.Container>
  )
}

export default function UriResolver() {
  const params = useParams<{ uri?: string }>()

  const decoded = decodeURIComponent(params.uri || '')
  const uri = React.useMemo(
    () => (decoded ? parsePackageUriSafe(decoded) : null),
    [decoded],
  )

  if (uri && !(uri instanceof BaseError)) {
    return <Redirect parsed={uri} decoded={decoded} />
  }

  return (
    <Layout>
      <Form initialValue={decoded} error={uri} />
    </Layout>
  )
}

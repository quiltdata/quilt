import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'
import * as SearchUIModel from 'containers/Search/model'
import StyledLink from 'utils/StyledLink'

import { usePackageCreationDialog } from './PackageDialog/PackageCreationForm'

const EXAMPLE_PACKAGE_URL = `${docs}/walkthrough/editing-a-package`

const useCreatePackageStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    marginRight: t.spacing(2),
    flexShrink: 0,
  },
  docs: {
    flexBasis: '40%',
  },
}))

interface CreatePackageProps {
  bucket: string
  className: string
}

function CreatePackage({ bucket, className }: CreatePackageProps) {
  const classes = useCreatePackageStyles()
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleClick = React.useCallback(() => createDialog.open(), [createDialog])
  return (
    <div className={cx(className, classes.root)}>
      <M.Button
        className={classes.button}
        color="primary"
        onClick={handleClick}
        variant="contained"
      >
        Create package
      </M.Button>
      <M.Typography className={classes.docs}>
        or{' '}
        <StyledLink href={EXAMPLE_PACKAGE_URL} target="_blank">
          push a package
        </StyledLink>{' '}
        with the Quilt Python API.
      </M.Typography>

      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
    </div>
  )
}

function useGoToGlobalSearchUrl() {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const globalSearch = SearchUIModel.useMakeUrl()
  return React.useMemo(
    () =>
      globalSearch({
        ...state,
        buckets: [],
        order: SearchUIModel.DEFAULT_ORDER,
        view: SearchUIModel.DEFAULT_VIEW,
      }),
    [globalSearch, state],
  )
}

const useEmptyStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    maxWidth: '30rem',
    marginTop: t.spacing(3),
  },
  list: {
    ...t.typography.body1,
    paddingLeft: 0,
  },
  create: {
    maxWidth: '30rem',
    borderBottom: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(2),
    paddingBottom: t.spacing(2),
  },
}))

interface EmptyProps {
  bucket: string
  className?: string
}

export default function NoPackages({ bucket, className }: EmptyProps) {
  const classes = useEmptyStyles()
  const {
    actions: { clearFilters, reset },
    state,
  } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const goToGlobalSearchUrl = useGoToGlobalSearchUrl()

  const startNewSearch = React.useCallback(() => {
    reset()
  }, [reset])

  let numFilters = state.filter.order.length + state.userMetaFilters.filters.size

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h4">No matching packages</M.Typography>

      <CreatePackage bucket={bucket} className={classes.create} />

      {numFilters ? (
        <>
          <M.Typography variant="body1" align="center" className={classes.body}>
            Search in <StyledLink to={goToGlobalSearchUrl}>all buckets</StyledLink>{' '}
            instead or adjust your search:
          </M.Typography>

          <ul className={classes.list}>
            {numFilters > 0 && (
              <li>
                Reset the <StyledLink onClick={clearFilters}>search filters</StyledLink>
              </li>
            )}
            <li>
              Start <StyledLink onClick={startNewSearch}>from scratch</StyledLink>
            </li>
          </ul>
        </>
      ) : (
        <M.Typography variant="body1" align="center" className={classes.body}>
          Search in <StyledLink to={goToGlobalSearchUrl}>all buckets</StyledLink> instead
          or start your search{' '}
          <StyledLink onClick={startNewSearch}>from scratch</StyledLink>.
        </M.Typography>
      )}
    </div>
  )
}

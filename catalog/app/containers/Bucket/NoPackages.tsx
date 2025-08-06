import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'
import * as SearchUIModel from 'containers/Search/model'
import * as NoResults from 'containers/Search/NoResults'
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
  onRefine: (action: NoResults.Refine) => void
}

export default function NoPackages({ bucket, className, onRefine }: EmptyProps) {
  const classes = useEmptyStyles()
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  let numFilters = state.filter.order.length + state.userMetaFilters.filters.size

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h4">No matching packages</M.Typography>

      <CreatePackage bucket={bucket} className={classes.create} />

      {numFilters ? (
        <>
          <M.Typography variant="body1" align="center" className={classes.body}>
            Search in{' '}
            <StyledLink onClick={() => onRefine(NoResults.Refine.Buckets)}>
              all buckets
            </StyledLink>{' '}
            instead or adjust your search:
          </M.Typography>

          <ul className={classes.list}>
            {numFilters > 0 && (
              <li>
                Reset the{' '}
                <StyledLink onClick={() => onRefine(NoResults.Refine.Filters)}>
                  search filters
                </StyledLink>
              </li>
            )}
            <li>
              Start{' '}
              <StyledLink onClick={() => onRefine(NoResults.Refine.New)}>
                from scratch
              </StyledLink>
            </li>
          </ul>
        </>
      ) : (
        <M.Typography variant="body1" align="center" className={classes.body}>
          Search in{' '}
          <StyledLink onClick={() => onRefine(NoResults.Refine.Buckets)}>
            all buckets
          </StyledLink>{' '}
          instead or start your search{' '}
          <StyledLink onClick={() => onRefine(NoResults.Refine.New)}>
            from scratch
          </StyledLink>
          .
        </M.Typography>
      )}
    </div>
  )
}

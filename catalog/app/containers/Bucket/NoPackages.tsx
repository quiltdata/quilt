import * as React from 'react'
import * as M from '@material-ui/core'

import Empty from 'components/Empty'
import { docs } from 'constants/urls'
import * as SearchUIModel from 'containers/Search/model'
import * as NoResults from 'containers/Search/NoResults'
import StyledLink from 'utils/StyledLink'

import { usePackageCreationDialog } from './PackageDialog/PackageCreationForm'

const EXAMPLE_PACKAGE_URL = `${docs}/walkthrough/editing-a-package`

interface CreatePackageProps {
  bucket: string
}

function CreatePackage({ bucket }: CreatePackageProps) {
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleClick = React.useCallback(() => createDialog.open(), [createDialog])
  return (
    <>
      <M.Button color="primary" onClick={handleClick} variant="contained">
        Create package
      </M.Button>
      <M.Typography>
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
    </>
  )
}

interface EmptyProps {
  bucket: string
  className?: string
  onRefine: (action: NoResults.Refine) => void
}

function WithFilters({ bucket, className, onRefine }: EmptyProps) {
  return (
    <Empty
      className={className}
      title="No matching packages"
      actions={<CreatePackage bucket={bucket} />}
    >
      <p>
        Search in{' '}
        <StyledLink onClick={() => onRefine(NoResults.Refine.Buckets)}>
          all buckets
        </StyledLink>{' '}
        instead or adjust your search:
      </p>
      <ul>
        <li>
          Reset the{' '}
          <StyledLink onClick={() => onRefine(NoResults.Refine.Filters)}>
            search filters
          </StyledLink>
        </li>
        <li>
          Start{' '}
          <StyledLink onClick={() => onRefine(NoResults.Refine.New)}>
            from scratch
          </StyledLink>
        </li>
      </ul>
    </Empty>
  )
}

function BareFilters({ bucket, className, onRefine }: EmptyProps) {
  return (
    <Empty
      className={className}
      title="No matching packages"
      actions={<CreatePackage bucket={bucket} />}
    >
      <p>
        Search in{' '}
        <StyledLink onClick={() => onRefine(NoResults.Refine.Buckets)}>
          all buckets
        </StyledLink>{' '}
        instead or start your search{' '}
        <StyledLink onClick={() => onRefine(NoResults.Refine.New)}>
          from scratch
        </StyledLink>
        .
      </p>
    </Empty>
  )
}

export default function NoPackages(props: EmptyProps) {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  let numFilters = state.filter.order.length + state.userMetaFilters.filters.size

  return numFilters ? <WithFilters {...props} /> : <BareFilters {...props} />
}

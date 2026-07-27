import cx from 'classnames'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import * as PD from 'containers/Bucket/PackageDialog'
import { useBucketStrict } from 'containers/Bucket/Routes'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'

import SortSelector from '../Sort'
import * as SearchUIModel from '../model'

import ColumnTitle from './ColumnTitle'

const useCreatePackageStyles = M.makeStyles({
  label: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

interface CreatePackageButtonProps {
  className: string
  onClick: () => void
}

function CreatePackageButton({ className, onClick }: CreatePackageButtonProps) {
  const classes = useCreatePackageStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  return xs ? (
    <M.Button
      className={className}
      color="primary"
      onClick={onClick}
      size="medium"
      variant="contained"
    >
      <M.Icon>add</M.Icon>
    </M.Button>
  ) : (
    <M.Button
      className={className}
      color="primary"
      onClick={onClick}
      size={sm ? 'medium' : 'small'}
      startIcon={<M.Icon>add</M.Icon>}
      variant="contained"
    >
      <span className={classes.label}>Create new package</span>
    </M.Button>
  )
}

interface CreatePackageProps {
  className: string
}

function CreatePackage({ className }: CreatePackageProps) {
  const bucket = useBucketStrict()
  const dst = React.useMemo(() => ({ bucket }), [bucket])
  const { open, render } = PD.useCreateDialog({
    dst,
    delayHashing: true,
    disableStateDisplay: true,
  })
  return (
    <>
      <CreatePackageButton className={className} onClick={open} />
      {render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
    </>
  )
}

const I18_COUNT_RESULTS = {
  one: '1 result',
  other: (n: number) => (n > 0 ? `${n} results` : 'Results'),
}

const I18_COUNT_PACKAGES = {
  one: '1 package',
  // `-1` == secure search
  other: (n: number) => (n > 0 ? `${n} packages` : 'Packages'),
}

function resultsCountI18n(n: number, state: SearchUIModel.SearchUrlState) {
  if (
    state.resultType === SearchUIModel.ResultType.QuiltPackage &&
    state.view === SearchUIModel.View.Table
  ) {
    return Format.pluralify(n, I18_COUNT_PACKAGES)
  }
  return Format.pluralify(n, I18_COUNT_RESULTS)
}

function ResultsCount() {
  const model = SearchUIModel.use()
  const r = model.firstPageQuery
  switch (r._tag) {
    case 'fetching':
      return <Lab.Skeleton width={140} />
    case 'error':
      return null
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
        case 'OperationError':
          return null
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          return <>{resultsCountI18n(r.data.total, model.state)}</>
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}

const useFiltersButtonStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

interface FiltersButtonProps {
  className: string
  onClick: () => void
}

function FiltersButton({ className, onClick }: FiltersButtonProps) {
  const classes = useFiltersButtonStyles()
  return (
    <M.Button
      startIcon={<M.Icon fontSize="inherit">filter_list</M.Icon>}
      variant="outlined"
      className={cx(classes.root, className)}
      onClick={onClick}
    >
      Filters
    </M.Button>
  )
}

const useToggleButtonStyles = M.makeStyles({
  root: {
    // So, it occupies the same height as other buttons in that toolbar
    padding: '5px',
    // XXX:
    // This is a color hardcoded for MUI.Button#outlined
    // https://github.com/mui/material-ui/blob/v4.x/packages/material-ui/src/Button/Button.js#L70
    // Latest Lab.ToggleButtonGroup has correct color, but we don't use it
    borderColor: `rgba(0, 0, 0, 0.23)`,
  },
})

interface ToggleResultsViewProps {
  className: string
}

function ToggleResultsView({ className }: ToggleResultsViewProps) {
  const classes = useToggleButtonStyles()
  const model = SearchUIModel.use()
  const handleChange = React.useCallback(
    (_e, value: SearchUIModel.View) => model.actions.setView(value),
    [model.actions],
  )
  return (
    <Lab.ToggleButtonGroup
      value={model.state.view}
      className={className}
      exclusive
      onChange={handleChange}
      size="small"
    >
      <Lab.ToggleButton value={SearchUIModel.View.Table} classes={classes}>
        <Icons.GridOn />
      </Lab.ToggleButton>
      <Lab.ToggleButton value={SearchUIModel.View.List} classes={classes}>
        <Icons.List />
      </Lab.ToggleButton>
    </Lab.ToggleButtonGroup>
  )
}

const useResultsStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'row',
    minHeight: t.spacing(4.5),
    flexWrap: 'wrap',
    [t.breakpoints.down('xs')]: {
      flexDirection: 'column',
    },
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    overflow: 'hidden',
  },
  title: {
    flexShrink: 0,
    marginRight: t.spacing(2),
  },
  create: {
    marginRight: t.spacing(4),
  },
  controlsInner: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
    whiteSpace: 'nowrap',
  },
}))

interface ResultsProps {
  onFilters?: () => void
}

export default function Results({ onFilters }: ResultsProps) {
  const model = SearchUIModel.use()
  const r = model.firstPageQuery
  const classes = useResultsStyles()
  const { paths } = NamedRoutes.use()
  return (
    <div className={classes.root}>
      <ColumnTitle className={classes.title}>
        <ResultsCount />
      </ColumnTitle>

      <div className={classes.controls}>
        <RRDom.Switch>
          <RRDom.Route path={paths.bucketRoot}>
            {r._tag === 'data' &&
              (r.data.__typename === 'ObjectsSearchResultSet' ||
                r.data.__typename === 'PackagesSearchResultSet') && (
                <CreatePackage className={classes.create} />
              )}
          </RRDom.Route>
        </RRDom.Switch>

        <div className={classes.controlsInner}>
          {model.state.resultType === SearchUIModel.ResultType.QuiltPackage && (
            <ToggleResultsView className={classes.button} />
          )}
          {onFilters && <FiltersButton className={classes.button} onClick={onFilters} />}
          <SortSelector className={classes.button} />
        </div>
      </div>
    </div>
  )
}

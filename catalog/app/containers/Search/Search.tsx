import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'

import * as SearchUIModel from './model'
import AssistantContext from './AssistantContext'
import Main from './Layout/Main'
import Container from './Layout/Container'
import ListResults from './List'
import TableResults from './Table'

const useStyles = M.makeStyles((t) => ({
  main: {
    padding: t.spacing(3, 0),
  },
  results: {
    marginTop: t.spacing(2),
  },
}))

function SearchLayout() {
  const model = SearchUIModel.use()
  const classes = useStyles()
  return (
    <Container state={model.state}>
      <MetaTitle>{model.state.searchString || 'Search'}</MetaTitle>
      <Main className={classes.main}>
        {model.state.view === SearchUIModel.View.Table &&
        model.state.resultType === SearchUIModel.ResultType.QuiltPackage ? (
          <TableResults className={classes.results} />
        ) : (
          <ListResults className={classes.results} />
        )}
      </Main>
    </Container>
  )
}

export default function Search() {
  return (
    <SearchUIModel.Provider>
      <AssistantContext />
      <Layout pre={<SearchLayout />} />
    </SearchUIModel.Provider>
  )
}

import { boundMethod } from 'autobind-decorator'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'
import { connect } from 'react-redux'
import { call, put } from 'redux-saga/effects'
import { createStructuredSelector } from 'reselect'

import AsyncResult from 'utils/AsyncResult'
import { injectReducer } from 'utils/ReducerInjector'
import { injectSaga } from 'utils/SagaInjector'
import * as RT from 'utils/reactTools'
import * as reduxTools from 'utils/reduxTools'
import { takeEveryTagged } from 'utils/sagaTools'
import tagged from 'utils/tagged'

const REDUX_KEY = 'data'

const Action = tagged(['Init', 'Request', 'Response', 'Dispose'])

function* handleRequest({ dataId, requestId, fetch, params }) {
  let result
  try {
    const res = yield call(fetch, params)
    result = AsyncResult.Ok(res)
  } catch (e) {
    result = AsyncResult.Err(e)
  }
  yield put(Action.Response({ dataId, requestId, result }))
}

function* saga() {
  yield takeEveryTagged(Action.Request, handleRequest)
}

const init = { id: -1, result: AsyncResult.Init() }

const reducer = reduxTools.withInitialState(
  {},
  Action.reducer({
    Init: (dataId) => R.assoc(dataId, init),
    Request: ({ dataId, requestId }) =>
      R.evolve({
        [dataId]: (s) => ({ id: requestId, result: AsyncResult.Pending(s.result) }),
      }),
    Response: ({ dataId, requestId, result }) =>
      R.evolve({
        [dataId]: (s) => (s.id === requestId ? { ...s, result } : s),
      }),
    Dispose: (dataId) => R.dissoc(dataId),
    __: () => R.identity,
  }),
)

export const Provider = RT.composeComponent(
  'Data.Provider',
  injectSaga(REDUX_KEY, saga),
  injectReducer(REDUX_KEY, reducer),
  RT.RenderChildren,
)

const nextId = (() => {
  let lastId = 0
  return () => {
    try {
      return lastId
    } finally {
      lastId += 1
    }
  }
})()

export const Fetcher = RT.composeComponent(
  'Data.Fetcher',
  RC.setPropTypes({
    params: PT.any,
    fetch: PT.func.isRequired,
    noAutoFetch: PT.bool,
    children: PT.func.isRequired,
  }),
  RC.withPropsOnChange(['fetch'], () => ({ id: nextId() })),
  connect(
    createStructuredSelector({
      data: (state, { id }) => state.get(REDUX_KEY)[id] || init,
    }),
    undefined,
    undefined,
    { pure: false },
  ),
  class FetcherInner extends React.Component {
    componentDidMount() {
      this.props.dispatch(Action.Init(this.props.id))
      if (!this.props.noAutoFetch) this.fetch()
    }

    componentDidUpdate({ params }) {
      if (!this.props.noAutoFetch) {
        if (!R.equals(params, this.props.params)) this.fetch()
      }
    }

    componentWillUnmount() {
      this.props.dispatch(Action.Dispose(this.props.id))
    }

    @boundMethod
    fetch() {
      this.props.dispatch(
        Action.Request({
          dataId: this.props.id,
          requestId: this.props.data.id + 1,
          fetch: this.props.fetch,
          params: this.props.params,
        }),
      )
    }

    render() {
      return this.props.children(this.props.data.result, { fetch: this.fetch })
    }
  },
)

export default Fetcher

export const withData = ({
  params: getParams = R.identity,
  fetch,
  name = 'data',
  autoFetch = true,
}) =>
  RT.composeHOC('Data.withData', (Component) => (props) => (
    <Fetcher fetch={fetch} params={getParams(props)} noAutoFetch={!autoFetch}>
      {(result, opts) => <Component {...{ ...props, [name]: { result, ...opts } }} />}
    </Fetcher>
  ))

import { boundMethod } from 'autobind-decorator'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'

import * as RT from 'utils/reactTools'

export const createBoundary = (handle, name = 'ErrorBoundary') => {
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props)
      this.state = { handled: null }
    }

    componentDidUpdate({ id: oldId }) {
      if (this.props.id !== oldId) this.reset()
    }

    componentDidCatch(error, info) {
      const { reset } = this
      const handled = handle(this.props, { reset })(error, info)
      if (handled && handled !== error) {
        this.setState({ handled })
      } else {
        throw error
      }
    }

    @boundMethod
    reset() {
      this.setState({ handled: null })
    }

    render() {
      return this.state.handled || this.props.children
    }
  }

  ErrorBoundary.displayName = name

  ErrorBoundary.propTypes = {
    children: PT.node,
    id: PT.string,
  }

  return ErrorBoundary
}

export const withBoundary = (handle) =>
  RT.composeHOC('withErrorBoundary', (Component) =>
    RC.nest(
      createBoundary(handle, `ErrorBoundary(${RC.getDisplayName(Component)})`),
      Component,
    ),
  )

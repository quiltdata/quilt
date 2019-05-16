import PT from 'prop-types'
import * as React from 'react'

export default class Delay extends React.Component {
  static propTypes = {
    ms: PT.number,
    children: PT.func.isRequired,
  }

  static defaultProps = {
    ms: 1000,
  }

  constructor() {
    super()
    this.state = { ready: false }
  }

  componentDidMount() {
    this.timeout = setTimeout(() => {
      clearTimeout(this.timeout)
      delete this.timeout
      this.setState({ ready: true })
    }, this.props.ms)
  }

  componentWillUnmount() {
    if (this.timeout) clearTimeout(this.timeout)
  }

  render() {
    return this.state.ready ? this.props.children() : null
  }
}

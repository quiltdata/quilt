import PT from 'prop-types'
import * as React from 'react'
import embed from 'vega-embed'

import './vega.css'

const VEGA_OPTIONS = {
  actions: {
    compiled: false,
    editor: false,
    export: true,
    source: false,
  },
}

// TODO: refactor to use hooks
class Vega extends React.Component {
  static propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    spec: PT.object.isRequired,
  }

  constructor() {
    super()
    this.state = { el: null }
    this.boundSetEl = this.setEl.bind(this)
  }

  componentDidMount() {
    this.embed()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.el !== this.state.el || prevProps.spec !== this.props.spec) this.embed()
  }

  setEl(el) {
    this.setState({ el })
  }

  embed() {
    if (this.state.el) embed(this.state.el, this.props.spec, VEGA_OPTIONS)
  }

  render() {
    const { spec, ...props } = this.props
    return <div ref={this.boundSetEl} {...props} />
  }
}

export default ({ spec }, props) => <Vega spec={spec} {...props} />

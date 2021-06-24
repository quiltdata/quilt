import { boundMethod } from 'autobind-decorator'
import PT from 'prop-types'
import * as React from 'react'
import embed from 'vega-embed'

// TODO: refactor to use hooks
class Vega extends React.Component {
  static propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    spec: PT.object.isRequired,
  }

  constructor() {
    super()
    this.state = { el: null }
  }

  componentDidMount() {
    this.embed()
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.el !== this.state.el || prevProps.spec !== this.props.spec) this.embed()
  }

  @boundMethod
  setEl(el) {
    this.setState({ el })
  }

  embed() {
    if (this.state.el) embed(this.state.el, this.props.spec, { actions: true })
  }

  render() {
    const { spec, ...props } = this.props
    return <div ref={this.setEl} {...props} />
  }
}

export default ({ spec }, props) => <Vega spec={spec} {...props} />

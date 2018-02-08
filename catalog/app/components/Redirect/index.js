/* Redirect */
import React, { PropTypes as PT } from 'react';

import redirect from 'utils/redirect';
import Working from 'components/Working';

export default class Redirect extends React.PureComponent {
  static propTypes = {
    url: PT.string.isRequired,
  }

  componentWillMount() {
    redirect(this.props.url);
  }
  render() {
    return (
      <div>
        <Working />
      </div>
    );
  }
}

/* Redirect */
import React from 'react';

import Working from 'components/Working';

export default class Redirect extends React.PureComponent {
  componentWillMount() {
    window.location = 'https://app.quiltdata.com/grna-search/';
  }
  render() {
    return (
      <div>
        <Working />
      </div>
    );
  }
}

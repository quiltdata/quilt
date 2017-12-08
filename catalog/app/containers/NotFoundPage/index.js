/* NotFoundPage - when no matching routes there are */
import React from 'react';

import Error from 'components/Error';

export default class NotFound extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  render() {
    return <Error headline="Nothing here" detail="Do you need to log in?" />;
  }
}

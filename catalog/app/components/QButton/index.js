/* Quilt button class wrapper for consistent custom style and logic */

import RaisedButton from 'material-ui/RaisedButton';
import React from 'react';

function QButton(props) {
  // swap primary and secondary for desirable color scheme
  return (
    <RaisedButton
      {...props}
      primary={props.secondary}
      secondary={props.primary}
    >
      { props.children }
    </RaisedButton>
  );
}

QButton.propTypes = {
  children: React.PropTypes.node,
  primary: React.PropTypes.bool,
  secondary: React.PropTypes.bool,
};

export default QButton;

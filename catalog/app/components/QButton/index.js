/* Quilt button class wrapper for consistent custom style and logic */
import RaisedButton from 'material-ui/RaisedButton';
import PropTypes from 'prop-types';
import React from 'react';

// TODO: deprecate?
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
  children: PropTypes.node,
  primary: PropTypes.bool,
  secondary: PropTypes.bool,
};

export default QButton;

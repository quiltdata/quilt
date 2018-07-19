/* SignIn */
import FlatButton from 'material-ui/FlatButton';
import RaisedButton from 'material-ui/RaisedButton';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';

import MIcon from 'components/MIcon';
import Spinner from 'components/Spinner';
import { authButtonStyle } from 'constants/style';

import strings from './messages';

const SignIn = ({ error, useNavStyle, waiting }) => {
  if (waiting) {
    return <Spinner className="fa-2x" drop="8px" />;
  }
  let icon = null;
  if (error) {
    const title = `${error.message}\n${JSON.stringify(error)}`;
    icon = <MIcon drop="6px" title={title}>error_outline</MIcon>;
  }
  const Button = useNavStyle ? FlatButton : RaisedButton;
  return (
    <div>
      {icon}
      <Button
        containerElement={<Link to="/signin" />}
        style={useNavStyle ? authButtonStyle : undefined}
      >
        <FormattedMessage {...strings.logIn} />
      </Button>
    </div>
  );
};

SignIn.propTypes = {
  error: PropTypes.object,
  useNavStyle: PropTypes.bool,
  waiting: PropTypes.bool.isRequired,
};

SignIn.defaultProps = {
  useNavStyle: true,
};

export default SignIn;

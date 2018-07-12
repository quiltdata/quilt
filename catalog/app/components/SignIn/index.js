/* SignIn */
import FlatButton from 'material-ui/FlatButton';
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { setPropTypes } from 'recompose';

import MIcon from 'components/MIcon';
import Spinner from 'components/Spinner';
import { authButtonStyle } from 'constants/style';
import { composeComponent } from 'utils/reactTools';

import strings from './messages';

export default composeComponent('SignIn',
  setPropTypes({
    error: PT.object,
    useNavStyle: PT.bool,
    waiting: PT.bool.isRequired,
  }),
  ({ error, useNavStyle = true, waiting }) => {
    if (waiting) {
      return <Spinner className="fa-2x" />;
    }
    const Button = useNavStyle ? FlatButton : RaisedButton;
    const btnStyle = useNavStyle ? authButtonStyle : undefined;
    return (
      <div>
        {error
          ? (
            <MIcon
              title={`${error.message}\n${JSON.stringify(error)}`}
              style={{ verticalAlign: 'middle' }}
            >
              error_outline
            </MIcon>
          )
          : null
        }
        <Button
          containerElement={<Link to="/signin" />}
          style={{ ...btnStyle, verticalAlign: 'middle' }}
        >
          <FormattedMessage {...strings.logIn} />
        </Button>
      </div>
    );
  });

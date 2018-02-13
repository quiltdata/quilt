/* UserMenu */
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import MIcon from 'components/MIcon';
import SignIn from 'components/SignIn';
import { authButtonStyle } from 'constants/style';

import strings from './messages';

const Container = styled.div`
  margin-top: 16px;
`;

// TODO move this to a separate local component
// eslint-disable-next-line object-curly-newline
const UserMenu = ({ error, signedIn, name, waiting }) => {
  const inner = signedIn ? <AuthMenu name={name} />
    : <SignIn error={error} waiting={waiting} />;
  return (
    <Container>
      { inner }
    </Container>
  );
};

UserMenu.propTypes = {
  error: PropTypes.object,
  signedIn: PropTypes.bool.isRequired,
  name: PropTypes.string,
  waiting: PropTypes.bool.isRequired,
};


const AuthMenu = ({ name }) => (
  <IconMenu
    iconButtonElement={
      <FlatButton
        label={
          <span>
            { name } <MIcon color={authButtonStyle.color} drop="6px">expand_more</MIcon>
          </span>
        }
        style={authButtonStyle}
      />
    }
    targetOrigin={{ horizontal: 'right', vertical: 'top' }}
    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
  >
    <MenuItem href="/profile">
      <FormattedMessage {...strings.profile} />
    </MenuItem>
    <Divider />
    <MenuItem href="/signout">
      <FormattedMessage {...strings.logOut} />
    </MenuItem>
  </IconMenu>
);

AuthMenu.muiName = 'IconMenu';

AuthMenu.propTypes = {
  name: PropTypes.string,
};

export default UserMenu;

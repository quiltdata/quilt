/* UserMenu */
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import { setPropTypes, setStatic } from 'recompose';
import styled from 'styled-components';

import MIcon from 'components/MIcon';
import SignIn from 'components/SignIn';
import { authButtonStyle } from 'constants/style';
import { composeComponent } from 'utils/reactTools';

import strings from './messages';

const Container = styled.div`
  margin-top: 16px;
`;

// TODO move this to a separate local component
export default composeComponent('UserMenu',
  setPropTypes({
    error: PropTypes.object,
    signedIn: PropTypes.bool.isRequired,
    name: PropTypes.string,
    waiting: PropTypes.bool.isRequired,
  }),
  // eslint-disable-next-line object-curly-newline
  ({ error, signedIn, name, waiting }) => (
    <Container>
      {signedIn
        ? <AuthMenu name={name} />
        : <SignIn error={error} waiting={waiting} />
      }
    </Container>
  ));

const renderItem = (to, msg) => (
  <MenuItem containerElement={<Link to={to} />}>
    <FormattedMessage {...msg} />
  </MenuItem>
);

const AuthMenu = composeComponent('UserMenu.AuthMenu',
  setStatic('muiName', 'IconMenu'),
  setPropTypes({
    name: PropTypes.string,
  }),
  ({ name }) => (
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
      {renderItem('/profile', strings.profile)}
      <Divider />
      {renderItem('/signout', strings.logOut)}
    </IconMenu>
  ));

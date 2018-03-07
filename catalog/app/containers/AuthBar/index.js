/* AuthBar - app wide navigation bar and user controls */
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { Col, Row } from 'react-bootstrap';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { push } from 'react-router-redux';
import { setPropTypes, withHandlers } from 'recompose';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import logo from 'img/logo/horizontal-white.png';
import logoTeam from 'img/logo/horizontal-white-team.png';

import status from 'constants/api';
import { backgroundColor } from 'constants/style';
import { blog, company, docs, jobs } from 'constants/urls';
import { setSearchText } from 'containers/App/actions';
import {
  makeSelectAuth,
  makeSelectSearchText,
  makeSelectSignedIn,
  makeSelectUserName,
} from 'containers/App/selectors';
import UserMenu from 'components/UserMenu';
import { composeComponent } from 'utils/reactTools';

import config from 'constants/config';

const Bar = styled(Row)`
  background-color: ${backgroundColor};
  color: white;
  padding: 0 16px 16px 16px
`;

const ColNoPad = styled(Col)`
  padding: 0;
`;

const navStyle = {
  color: '#ddd',
};

const NavRow = styled(Row)`
  background-color: rgb(0, 0, 0);
  border-bottom: 1px solid rgb(24, 24, 24);
  margin-left: -16px;
  margin-right: -16px;
`;

const Right = styled.div`
  text-align: right;
`;

export default composeComponent('AuthBar',
  connect(createStructuredSelector({
    auth: makeSelectAuth(),
    searchText: makeSelectSearchText(),
    signedIn: makeSelectSignedIn(),
    name: makeSelectUserName(),
  })),
  setPropTypes({
    dispatch: PropTypes.func.isRequired,
    auth: PropTypes.object,
    searchText: PropTypes.string,
    signedIn: PropTypes.bool.isRequired,
    name: PropTypes.string,
  }),
  withHandlers({
    handleSearch: ({ dispatch }) => (query) => {
      // submit search via query param to the search results page
      dispatch(push(`/search/?q=${encodeURIComponent(query)}`));
    },
    handleChange: ({ dispatch }) => (text) => {
      dispatch(setSearchText(text));
    },
  }),
  // eslint-disable-next-line object-curly-newline
  ({ auth, name, searchText, signedIn, handleChange, handleSearch }) => (
    <Bar>
      <NavRow>
        <Right>
          <FlatButton href={docs} label="docs" style={navStyle} />
          {config.team ? null : (
            <Fragment>
              <FlatButton
                containerElement={<Link to="/#pricing" />}
                label="pricing"
                key="pricing"
                style={{ ...navStyle, verticalAlign: 'middle' }}
              />
              <FlatButton href={jobs} key="jobs" label="jobs" style={navStyle} />
            </Fragment>
          )}
          <FlatButton href={blog} label="blog" style={navStyle} />
          <FlatButton href={company} label="about" style={navStyle} />
        </Right>
      </NavRow>
      <ColNoPad xs={12} sm={6} smPush={6}>
        <Right>
          <UserMenu
            error={auth.error}
            signedIn={signedIn}
            name={name}
            waiting={auth.status === status.WAITING}
          />
        </Right>
      </ColNoPad>
      <ColNoPad xs={12} sm={6} smPull={6}>
        <LeftGroup {...{ handleChange, handleSearch, searchText }} />
      </ColNoPad>
    </Bar>
  ));


const Lockup = styled.div`
  display: inline-block;
  margin-right: 16px;
  > img {
    height: 36px;
  }
  vertical-align: top;
`;

const hintStyle = {
  bottom: '4px',
  color: '#AAA',
};

const inputStyle = {
  color: '#DDD',
};

const searchStyle = {
  backgroundColor: 'rgba(255, 255, 255, .10)',
  borderRadius: '4px',
  fontSize: '15px',
  height: '36px',
  paddingLeft: '8px',
  paddingRight: '8px',
  width: 'calc(100% - 140px)',
};

const { team } = config;

const LeftGroup = composeComponent('AuthBar.LeftGroup',
  setPropTypes({
    handleChange: PropTypes.func.isRequired,
    handleSearch: PropTypes.func.isRequired,
    searchText: PropTypes.string.isRequired,
  }),
  withHandlers({
    // eslint will cry about evt but we need the second positional arg
    // eslint-disable-next-line no-unused-vars
    handleChange: ({ handleChange }) => (_evt, text) => {
      handleChange(text);
    },
    handleEnter: ({ handleSearch, searchText }) => (evt) => {
      if (evt.key === 'Enter') {
        // suppress onSubmit (didn't actually find this to be a problem tho)
        evt.preventDefault();
        handleSearch(searchText);
      }
    },
  }),
  ({ handleChange, handleEnter, searchText }) => (
    <div style={{ marginTop: '16px' }}>
      <Link to="/">
        <Lockup>
          <img alt="Quilt logo" src={team ? logoTeam : logo} />
        </Lockup>
      </Link>
      <TextField
        hintStyle={hintStyle}
        hintText={`Search ${team ? team.name || team.id : ''}`}
        inputStyle={inputStyle}
        onChange={handleChange}
        onKeyPress={handleEnter}
        style={searchStyle}
        underlineShow={false}
        value={searchText}
      />
    </div>
  ));

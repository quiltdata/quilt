/* AuthBar - app wide navigation bar and user controls */
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import PropTypes from 'prop-types';
import React from 'react';
import { Col, Row } from 'react-bootstrap';
import { Link } from 'react-router';
import { push } from 'react-router-redux';
import styled from 'styled-components';

import { setSearchText } from 'containers/App/actions';
import logo from 'img/logo/horizontal-white.png';
import { backgroundColor } from 'constants/style';
import { blog, company, docs } from 'constants/urls';
import UserMenu from 'components/UserMenu';

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
  background-color: rgba(0, 0, 0, .3);
  border-bottom: 1px solid #222;
  margin-left: -16px;
  margin-right: -16px;
`;

const Right = styled.div`
  text-align: right;
`;

export class AuthBar extends React.PureComponent { // eslint-disable-line react/prefer-stateless-function
  handleSearch = (query) => {
    // submit search via query param to the search results page
    this.props.dispatch(push(`/search/?q=${encodeURIComponent(query)}`));
  }

  handleChange = (text) => {
    this.props.dispatch(setSearchText(text));
  }

  render() {
    // eslint-disable-next-line object-curly-newline
    const { error, name, searchText, signedIn, waiting } = this.props;
    const menu = (
      <UserMenu
        error={error}
        signedIn={signedIn}
        name={name}
        waiting={waiting}
      />
    );
    return (
      <Bar>
        <NavRow>
          <Right>
            <FlatButton href="/#pricing" label="pricing" style={navStyle} />
            <FlatButton href={blog} label="blog" style={navStyle} />
            <FlatButton href={docs} label="docs" style={navStyle} />
            <FlatButton href={company} label="about" style={navStyle} />
          </Right>
        </NavRow>
        <ColNoPad xs={12} sm={6} smPush={6}>
          <Right>
            { menu }
          </Right>
        </ColNoPad>
        <ColNoPad xs={12} sm={6} smPull={6}>
          <LeftGroup
            handleChange={this.handleChange}
            handleSearch={this.handleSearch}
            searchText={searchText}
          />
        </ColNoPad>
      </Bar>
    );
  }
}

AuthBar.propTypes = {
  dispatch: PropTypes.func.isRequired,
  error: PropTypes.object,
  searchText: PropTypes.string,
  signedIn: PropTypes.bool.isRequired,
  name: PropTypes.string,
  waiting: PropTypes.bool.isRequired,
};

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
  backgroundColor: 'rgba(255, 255, 255, .20)',
  borderRadius: '4px',
  fontSize: '15px',
  height: '36px',
  paddingLeft: '8px',
  paddingRight: '8px',
  width: 'calc(100% - 140px)',
};

class LeftGroup extends React.PureComponent { //  eslint-disable-line react/no-multi-comp
  // eslint will cry about evt but we need the second positional arg
  /* eslint-disable no-unused-vars */
  handleChange = (evt, str) => {
    this.props.handleChange(str);
  }
  /* eslint-enable no-unused-vars */
  handleEnter = (evt) => {
    if (evt.key === 'Enter') {
      // suppress onSubmit (didn't actually find this to be a problem tho)
      evt.preventDefault();
      this.props.handleSearch(this.props.searchText);
    }
  }

  render() {
    return (
      <div style={{ marginTop: '16px' }}>
        {/* eslint-disable jsx-a11y/anchor-is-valid */}
        <Link to="/">
          <Lockup>
            <img alt="Quilt logo" src={logo} />
          </Lockup>
        </Link>
        {/* eslint-enable jsx-a11y/anchor-is-valid */}
        <TextField
          hintStyle={hintStyle}
          hintText="Search packages"
          inputStyle={inputStyle}
          onChange={this.handleChange}
          onKeyPress={this.handleEnter}
          style={searchStyle}
          underlineShow={false}
          value={this.props.searchText}
        />
      </div>
    );
  }
}

LeftGroup.propTypes = {
  handleChange: PropTypes.func.isRequired,
  handleSearch: PropTypes.func.isRequired,
  searchText: PropTypes.string.isRequired,
};


export default AuthBar;

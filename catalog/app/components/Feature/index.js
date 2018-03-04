/* Main landing page feature */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import RaisedButton from 'material-ui/RaisedButton';
import ImageRow from 'components/ImageRow';
import background from 'img/back/black-hex.jpg';
import config from 'constants/config';
import { docs } from 'constants/urls';

import strings from './messages';

/* eslint-disable jsx-a11y/no-static-element-interactions */
const Feature = ({ header, tagline }) => (
  <ImageRow backgroundColor="black" src={background}>
    <Content>
      <h1 className="main">
        { header }
      </h1>
      <h2 className="main">
        { tagline }
      </h2>
      <div className="left">
        <RaisedButton href={docs} label="Get started" />
      </div>
      {
        config.team ? null : (
          <div className="right">
            <iframe
              title="Star Quilt on GitHub"
              src="https://ghbtns.com/github-btn.html?user=quiltdata&repo=quilt&type=star&count=true&size=large"
              frameBorder="0"
              scrolling="0"
              width="160px"
              height="30px"
            />
          </div>
        )
      }
    </Content>
  </ImageRow>
);

/* TODO do not abuse string tables like this; belongs in a FormattedMessage, but
 * those don't support default values well? */
Feature.defaultProps = {
  header: strings.header.defaultMessage,
  tagline: strings.tagline.defaultMessage,
};

Feature.propTypes = {
  header: PropTypes.string,
  tagline: PropTypes.string,
};

const Content = styled.div`
  border-bottom: 1px solid backgroundColor;
  padding: 64px;
  position: relative;
  text-align: center;

  h1.main, h2.main {
    color: white;
    font-size: 4em;
    margin: 0;
    text-align: left;
    text-shadow: 0px 0px 0px black;

  }

  h1.main {
    font-weight: bold;
    margin-top: 0;
  }

  h2.main {
    color: #F88500;
    margin-bottom: 64px;
  }

  .left {
    text-align: left;
  }

  .right {
    margin-top: 64px;
    text-align: right;
  }

  iframe {
    display: inline-block;
    width: 135px;
  }
`;

export default Feature;

/* Main landing page feature */
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import ImageRow from 'components/ImageRow';
import background from 'img/back/polygon-light.jpg';
import { breaks } from 'constants/style';
import TakeAction from 'components/TakeAction';

import strings from './messages';

const xs = `${breaks.sm - 1}px`;

/* eslint-disable jsx-a11y/no-static-element-interactions */
const Feature = ({ header, tagline, signUp }) => (
  <ImageRow backgroundColor="#F6B500" src={background}>
    <Content>
      <h1 className="main">
        { header }
      </h1>
      <h2 className="main">
        { tagline }
      </h2>
      <TakeAction signUp={signUp} />
      <div className="framer">
        <iframe
          title="Star Quilt on GitHub"
          src="https://ghbtns.com/github-btn.html?user=quiltdata&repo=quilt&type=star&count=true&size=large"
          frameBorder="0"
          scrolling="0"
          width="160px"
          height="30px"
        />
      </div>
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
  signUp: PropTypes.bool,
};

const Content = styled.div`
  border-bottom: 1px solid backgroundColor;
  padding: 64px;
  position: relative;
  text-align: center;

  br {
    background-color: red;
    height: 64px;
  }

  h1.main, h2.main {
    color: rgba(8, 8, 8, .8);
    margin: 0;
  }

  h1.main {
    font-size: 5vw;
    font-weight: bold;
    text-transform: uppercase;
  }

  h2.main {
    font-size: 5vw;
    margin-bottom: 64px;
  }

  .framer {
    position: relative;
    margin-top: 64px;
    text-align: right;
  }

  .framer iframe {
    display: inline-block
    width: 135px;
  }

  @media (max-width:${xs}) {
    h1.main {
      font-size: 1.5em;
    }

    h2.main {
      font-size: 1.5em;
    }
  }
`;

export default Feature;

/* Intro */
import React, { PropTypes } from 'react';
import { Col, Row } from 'react-bootstrap';
import styled from 'styled-components';

import speedometer from 'img/art/accelerate.png';
import Gallery from 'containers/Gallery';
import palette from 'img/art/palette.png';
import pkg from 'img/art/package.png';

const Styler = styled.div`
  .intro-row:not(:first-child) {
    margin-top: 5em;
  }

  .intro-row h1 {
    font-size: 3em;
  }

  .intro-row p {
    font-size: 1.1em;
  }

  .intro-row img {
    display: block;
    margin: 0 auto;
    margin-top: 3em;
    max-width: 400px;
    width: 90%;
  }

  img.fade {
    filter: grayscale(50%);
  }
`;

const Terminal = styled.div`
  backgroundColor: rgb(32, 32, 32);
  color: #ddd;
  font-size: 1.2em;
  margin: 1em 1em 1em 0;
  padding: 1em;
  width: auto;

  span {
    display: block;
  }
`;

function Intro() {
  return (
    <Styler>
      <IntroRow
        detail={
          <div>
            <p>
              Install data with one command.
              Discover packages from the community.
              Share your packages (or keep them private).
            </p>
            <p>
              Just finished some heroic data collection?
              Package it for the benefit of others.
            </p>
          </div>
        }
        src={palette}
        title="Create a library of data"
        typing={
          <div>
            <span> $ pip install quilt</span>
            <span> $ quilt install uciml/iris</span>
          </div>
        }
      />
      <br />
      <Gallery />
      <IntroRow
        detail={
          <div>
            <p>
              Quilt stores a complete revision history for every package.
              Versioned data yields predictable, reproducible results.
              Lose something? Roll back and start over.
            </p>
            <h1>Organize scattered files</h1>
            <p>
              Combine numerous files and folders into simple, reusable packages.
              Quilt de-duplicates repeated files, minimizing network and storage
              bottlenecks.
            </p>
          </div>
        }
        src={pkg}
        textRight
        title="Version your data"
      />
      <IntroRow
        detail={
          <div>
            <p>
              Import clean data with one line of code. Start working.
              No more scripting to download, clean, and load data.
            </p>
            <p>
              Quilt invisibly converts your data to Apache Parquet, a columnar storage format,
              for faster I/O and faster analysis with Presto DB and Hadoop tools.
            </p>
          </div>
        }
        src={speedometer}
        srcFade
        title="Analyze faster"
        typing={
          <div>
            <span>from quilt.data.uciml import iris</span>
            <span>df &#61; iris.tables.iris() &#35; done - you&#39;ve got data</span>
          </div>
        }
      />

    </Styler>
  );
}

Intro.propTypes = {

};

const ClipCol = styled(Col)`
  overflow: hidden;
`;

function IntroRow({ detail, src, srcFade, textRight, title, typing }) {
  const text = (
    <Col key="text" xs={12} sm={7}>
      <h1>{ title }</h1>
      { detail }
      {
        typing ?
          <Terminal className="fixed">
            { typing }
          </Terminal> : null
      }
    </Col>
  );

  const picture = (
    <ClipCol key="picture" xs={12} sm={5}>
      <img
        alt="descriptive feature"
        className={srcFade ? 'fade' : ''}
        src={src}
      />
    </ClipCol>
  );

  return (
    <Row className="intro-row">
      { textRight ? [picture, text] : [text, picture] }
    </Row>
  );
}

IntroRow.propTypes = {
  detail: PropTypes.node.isRequired,
  src: PropTypes.string.isRequired,
  srcFade: PropTypes.bool,
  textRight: PropTypes.bool,
  title: PropTypes.node.isRequired,
  typing: PropTypes.node,
};

export default Intro;

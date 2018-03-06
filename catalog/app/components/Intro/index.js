/* Intro */
import PropTypes from 'prop-types';
import React from 'react';
import { Col, Row } from 'react-bootstrap';
import styled from 'styled-components';

import collab from 'img/art/collaborate.png';
import speedometer from 'img/art/accelerate.png';
import Gallery from 'containers/Gallery';
import palette from 'img/art/palette.png';
import pkg from 'img/art/package.png';

const Styler = styled.div`
  margin-top: 2em;

  .intro-row:not(:nth-child(2)) {
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
  background-color: rgb(32, 32, 32);
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
      <Gallery />
      <IntroRow
        detail={
          <div>
            <p>
              Move data with one command.
              Discover packages from the community.
              Share your packages (or keep them private).
            </p>
            <p>
              Just finished some heroic data collection?
              Package it for the benefit of others.
            </p>
          </div>
        }
        src={pkg}
        title="Get started"
        typing={
          <div>
            <span> $ pip install quilt</span>
            <span> $ quilt install uciml/iris</span>
            <span> $ python</span>
            <span> &rt;&rt;&rt; from quilt.data.uciml import iris</span>
            <span> &hash; you&#39;ve got data</span>
          </div>
        }
      />
      <IntroRow
        detail={
          <div>
            <p>
              Quilt stores immutable versions for every piece of data.
              Reproduce analyses from any point in time.
              Lose something? Roll back and start over.
            </p>
            <h1>Organize scattered files</h1>
            <p>
              Combine numerous files and folders into simple, reusable packages.
              Quilt deduplicates repeated files, minimizing network and storage
              bottlenecks.
            </p>
          </div>
        }
        src={palette}
        textRight
        title="Reproduce analysis"
      />
      <IntroRow
        detail={
          <div>
            <p>
              Quilt integrates data sources so that everyone is on the same page.
              Quilt Team Edition offers a high-security, dedicated data registry
              where colleagues can discover and share data.
            </p>
            <h1>Audit every access</h1>
            <p>
              Quilt admins can audit every read
              and every change to the data.
            </p>
          </div>
        }
        src={collab}
        title="Collaborate in teams"
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
        textRight
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

// eslint-disable-next-line object-curly-newline
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

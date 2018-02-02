/* Error */
import PropTypes from 'prop-types';
import React from 'react';
import { Col, Row } from 'react-bootstrap';

import ImageRow from 'components/ImageRow';
import { printObject } from 'utils/string';

import sand from './sand.jpg';

// TODO add sign in
function Error({
  detail = 'Check network connection and login',
  headline = 'Something went wrong',
  object = {},
}) {
  return (
    <div>
      <h1>{ headline }</h1>
      <h2>{ detail }</h2>
      <Col xs={12}>
        <ImageRow height="600px" src={sand} />
      </Col>
      <Row>
        <Col xs={12}>
          <pre>
            { printObject(object) }
          </pre>
        </Col>
      </Row>
    </div>
  );
}

Error.propTypes = {
  headline: PropTypes.string,
  detail: PropTypes.string,
  object: PropTypes.object,
};

export default Error;

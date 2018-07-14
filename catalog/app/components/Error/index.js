/* Error */
import PT from 'prop-types';
import React from 'react';
import { Col, Row } from 'react-bootstrap';
import { setPropTypes } from 'recompose';

import ImageRow from 'components/ImageRow';
import { composeComponent } from 'utils/reactTools';
import { printObject } from 'utils/string';

import sand from './sand.jpg';

// TODO add sign in
export default composeComponent('Error',
  setPropTypes({
    headline: PT.node,
    detail: PT.node,
    object: PT.object,
  }),
  ({
    detail = 'Check network connection and login',
    headline = 'Something went wrong',
    object,
  }) => (
    <div>
      <h1>{headline}</h1>
      <h2>{detail}</h2>
      <ImageRow height="600px" src={sand} />
      {!!object && (
        <Row>
          <Col xs={12}>
            <pre>
              {printObject(object)}
            </pre>
          </Col>
        </Row>
      )}
    </div>
  ));

/* Learn more */
import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
// import styled from 'styled-components';

import { gitWeb } from 'constants/urls';

import strings from './messages';

const repo = <a href={gitWeb}><FormattedMessage {...strings.contributeCall} /></a>;

function Learn() {
  return (
    <Row>
      <Col xs={12}>
        <h1><FormattedMessage {...strings.open} /></h1>
        <p><FormattedMessage {...strings.contribute} values={{ repo }} /></p>
      </Col>
    </Row>
  );
}

Learn.propTypes = {

};

export default Learn;

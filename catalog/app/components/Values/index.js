/* Value propositions of the product */
import React from 'react';
import { Row, Col } from 'react-bootstrap';
import styled from 'styled-components';

import { Stack } from 'components/LayoutHelpers';
import Value from 'components/Value';
import jupyter from 'img/values/jupyter.png';
import machine from 'img/values/machine.png';
import pandas from 'img/values/pandas.png';
import python from 'img/values/python.png';

// tired of react-intl which makes it hella hard to HTML format strings
import strings from './messages';

const StyledRow = styled(Row)`
  h1 {
    margin-bottom: 1em;
    text-align: center;
  }
  
  code {
    background-color: transparent;
  }
`;

/* Values - value propositions of product */
const Values = () => (
  <StyledRow>
    <Col xs={12}>
      <Row>
        <Stack>
          <Col xs={12} sm={6} lg={3}>
            <Value
              src={python}
              title={strings.python}
            >
              <div>{strings.pythonDetail}</div>
            </Value>
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <Value
              src={pandas}
              title={strings.pandas}
            >
              <div>{strings.pandasDetail}</div>
            </Value>
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <Value
              src={jupyter}
              title={strings.jupyter}
            >
              <div>{strings.jupyterDetail}</div>
            </Value>
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <Value
              src={machine}
              title={strings.machine}
            >
              <div>{strings.machineDetail}</div>
            </Value>
          </Col>
        </Stack>
      </Row>
    </Col>
  </StyledRow>
);

export default Values;

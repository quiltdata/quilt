import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { Tabs, Tab } from 'material-ui/Tabs';

import Markdown from 'components/Markdown';
import { plainTextStyle } from 'constants/style';

import strings from './messages';
import python from './python.md';

//  export name so parent components can anchor-link to this component
export const name = 'get_started';
/* GetStarted - How to use Quilt
 * id={name} trick is to support anchor links that jump to this component
 * name={name} does not work :/
*/
const GetStarted = () => (
  <Row id={name}>
    <Col xs={12}>
      <h1><FormattedMessage {...strings.title} /></h1>
      <p><FormattedMessage {...strings.free} /></p>
      <Tabs>
        <Tab buttonStyle={plainTextStyle} label="Python">
          <Box>
            <Markdown data={python} />
          </Box>
        </Tab>
        <Tab buttonStyle={plainTextStyle} label="R (soon)" />
        <Tab buttonStyle={plainTextStyle} label="Spark (soon)" />
      </Tabs>
    </Col>
  </Row>
);

const Box = styled.div`
  padding: 1em;

  ol {
    padding-left: 2em;
  }
`;

export default GetStarted;

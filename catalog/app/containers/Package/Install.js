/* Install - how to install a given package */
import { Tabs, Tab } from 'material-ui/Tabs';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import config from 'constants/config';
import { installQuilt } from 'constants/urls';
import { makeHandle } from 'utils/string';

import strings from './messages';

const Code = styled.code`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1em;
`;

const Unselectable = styled.span`
  user-select: none;
`;

const Install = ({ name, owner }) => (
  <div>
    <h2>
      <FormattedMessage {...strings.getData} />
    </h2>
    <p>
      <FormattedMessage {...strings.install} />&nbsp;
      <a href={installQuilt}>
        <FormattedMessage {...strings.installLink} />
      </a>&nbsp;
      <FormattedMessage {...strings.installThen} />
    </p>
    <Code>
      <Unselectable>$ </Unselectable>quilt install {makeHandle(owner, name)}
    </Code>
    <h2><FormattedMessage {...strings.access} /></h2>
    <Tabs>
      <Tab label="Python">
        {
          config.team
            ? <Code>from quilt.team.{config.team.id}.{owner} import {name}</Code>
            : <Code>from quilt.data.{owner} import {name}</Code>
        }
      </Tab>
    </Tabs>
  </div>
);

Install.propTypes = {
  name: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
};

export default Install;

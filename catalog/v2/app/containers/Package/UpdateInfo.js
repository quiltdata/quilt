/* Install - how to install a given package */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedDate, FormattedMessage, FormattedNumber, FormattedRelative } from 'react-intl';
import styled from 'styled-components';

import config from 'constants/config';
import Ellipsis from 'components/Ellipsis';
import { readableBytes } from 'utils/string';

import strings from './messages';

function readableExtensions(fileCounts = {}) {
  const keys = Object.keys(fileCounts);
  keys.sort();
  return keys.map((k) => {
    const key = k || 'None';
    const count = <FormattedNumber value={fileCounts[k]} />;
    return <Line key={key}><span>{key}</span>{count}</Line>;
  });
}

const Line = styled.span`
  display: block;
  span {
    display: inline-block;
    width: 5em;
  }
`;

const UpdateInfo = ({
  author,
  fileTypes,
  size,
  time,
  version,
}) => {
  const date = (
    <FormattedDate
      value={new Date(time)}
      month="long"
      day="numeric"
      year="numeric"
      hour="numeric"
      minute="numeric"
    />
  );
  const since = <FormattedRelative value={new Date(time)} />;
  return (
    <div>
      <h2><FormattedMessage {...strings.latest} /></h2>
      <dl>
        <dt>{since}</dt>
        <dd>{date}</dd>
        <dt><FormattedMessage {...strings.author} /></dt>
        <dd>{config.team ? `${config.team.id}:` : ''}{author}</dd>

        <dt><FormattedMessage {...strings.version} /></dt>
        <dd>
          <Ellipsis title={version}>
            {version}
          </Ellipsis>
        </dd>
        <dt><FormattedMessage {...strings.stats} /></dt>
        <dd title="deduplicated, uncompresssed">
          {readableBytes(size)}
        </dd>
        <dt><FormattedMessage {...strings.fileStats} /></dt>
        <dd>
          {readableExtensions(fileTypes)}
        </dd>
      </dl>
    </div>
  );
};

UpdateInfo.propTypes = {
  author: PropTypes.string,
  time: PropTypes.number,
  fileTypes: PropTypes.object,
  size: PropTypes.number,
  version: PropTypes.string,
};

export default UpdateInfo;

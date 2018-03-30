/* Log - display version log */
import React from 'react';
import { FormattedDate } from 'react-intl';
import styled from 'styled-components';

const Entry = styled.div`
  margin-top: 2em;
  margin-bottom: 2em;
`;

const Name = styled.span`
  display: inline-block;
  font-weight: bolder;
  margin-right: 1em;
  width: 5em;
`;

const Row = styled.span`
  display: block;
  font-weight: lighter;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Log = ({ entries = [] }) => {
  entries = entries.concat(entries);
  return entries.map(({ author, created, hash, tags, versions }) => {
    tags = tags || [];
    versions = versions || [];
    return (
      <Entry>
        <Row>
          <Name>date</Name>&nbsp;
          <FormattedDate
            value={new Date(created*1000)}
            month="long"
            day="numeric"
            year="numeric"
            hour="numeric"
            minute="numeric"
          />
        </Row>
        <Row>
          <Name>hash</Name> {hash}
        </Row>
        <Row>
          <Name>author</Name> {author}
        </Row>
        <Row>
          <Name>tags</Name> {tags.join(", ")}<br />
        </Row>
        <Row>
          <Name>versions</Name> {versions.join(", ")}<br />
        </Row>
      </Entry>
    );
  });
};

export default Log;
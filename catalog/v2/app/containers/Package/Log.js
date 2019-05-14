/* Log - display version log */
import React from 'react';
import { FormattedDate } from 'react-intl';
import styled from 'styled-components';

const Entry = styled.div`
  border-bottom: 1px solid #ddd;
  margin: 1em 0 1em 0;
  padding: 1em 2em;
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

const Log = ({ entries = [] }) => (
  entries.reverse().map(
    ({ author, created, hash, tags = [], versions = [] }) => {
      // yes, we still have to do this because if tags = null it won't get [] :(
      const safeTags = tags || [];
      const safeVersions = versions || [];
      return (
        <Entry key={created}>
          <Row>
            <Name>date</Name>&nbsp;
            <FormattedDate
              value={new Date(created * 1000)}
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
            <Name>tags</Name> {safeTags.join(', ')}<br />
          </Row>
          <Row>
            <Name>versions</Name> {safeVersions.join(', ')}<br />
          </Row>
        </Entry>
      );
    }
  )
);

export default Log;

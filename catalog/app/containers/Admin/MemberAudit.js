import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import PT from 'prop-types';
import React from 'react';
import { Link } from 'react-router';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import { formatDate } from './util';

export default compose(
  setPropTypes({
    entries: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        time: PT.number.isRequired,
        handle: PT.string.isRequired,
        event: PT.string.isRequired,
      }).isRequired
    ).isRequired, // eslint-disable-line function-paren-newline
  }),
  setDisplayName('Admin.MemberAudit'),
)(({ entries }) => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Time</TableHeaderColumn>
        <TableHeaderColumn>Package</TableHeaderColumn>
        <TableHeaderColumn>Event</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {
        entries.map(({ time, handle, event }) => (
          <TableRow hoverable key={`${time} ${handle} ${event}`}>
            <TableRowColumn>{formatDate(time)}</TableRowColumn>
            <TableRowColumn><Link to={`/package/${handle}`}>{handle}</Link></TableRowColumn>
            <TableRowColumn>{event}</TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
));

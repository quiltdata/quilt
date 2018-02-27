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
import { FormattedMessage as FM } from 'react-intl';
import { Link } from 'react-router';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import msg from './messages';
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
        <TableHeaderColumn><FM {...msg.memberAuditTime} /></TableHeaderColumn>
        <TableHeaderColumn><FM {...msg.memberAuditPackage} /></TableHeaderColumn>
        <TableHeaderColumn><FM {...msg.memberAuditEvent} /></TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {entries.length
        ? entries.map(({ time, handle, event }) => (
          <TableRow hoverable key={`${time} ${handle} ${event}`}>
            <TableRowColumn>{formatDate(time)}</TableRowColumn>
            <TableRowColumn><Link to={`/package/${handle}`}>{handle}</Link></TableRowColumn>
            <TableRowColumn>{event}</TableRowColumn>
          </TableRow>
        ))
        : (
          <TableRow>
            <TableRowColumn colSpan={3}><FM {...msg.memberAuditEmpty} /></TableRowColumn>
          </TableRow>
        )
      }
    </TableBody>
  </Table>
));

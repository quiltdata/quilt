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
import { Link } from 'react-router-dom';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import msg from './messages';
import { formatDate } from './util';

export default compose(
  setPropTypes({
    entries: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        time: PT.number.isRequired,
        user: PT.string.isRequired,
        event: PT.string.isRequired,
      }).isRequired
    ).isRequired, // eslint-disable-line function-paren-newline
  }),
  setDisplayName('Admin.PackageAudit'),
)(({ entries }) => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn><FM {...msg.pkgAuditTime} /></TableHeaderColumn>
        <TableHeaderColumn><FM {...msg.pkgAuditUser} /></TableHeaderColumn>
        <TableHeaderColumn><FM {...msg.pkgAuditEvent} /></TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {entries.length
        ? entries.map(({ time, user, event }) => (
          <TableRow hoverable key={`${time} ${user} ${event}`}>
            <TableRowColumn>{formatDate(time)}</TableRowColumn>
            <TableRowColumn>
              {user === 'public'
                ? user
                : <Link to={`/user/${user}`}>{user}</Link>
              }
            </TableRowColumn>
            <TableRowColumn>{event}</TableRowColumn>
          </TableRow>
        ))
        : (
          <TableRow>
            <TableRowColumn colSpan={3}><FM {...msg.pkgAuditEmpty} /></TableRowColumn>
          </TableRow>
        )
      }
    </TableBody>
  </Table>
));

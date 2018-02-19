import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
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
import { compose, setPropTypes, setDisplayName } from 'recompose';

import Working from 'components/Working';
import api, { apiStatus } from 'constants/api';

import { branch, formatDate } from './util';

const AuditTable = compose(
  setPropTypes({
    entries: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        time: PT.number.isRequired,
        user: PT.string.isRequired,
        event: PT.string.isRequired,
      }).isRequired
    ).isRequired, // eslint-disable-line function-paren-newline
  }),
  setDisplayName('Admin.PackageAudit.Table'),
)(({ entries }) => (
  <Table selectable={false}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn>Time</TableHeaderColumn>
        <TableHeaderColumn>User</TableHeaderColumn>
        <TableHeaderColumn>Event</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody displayRowCheckbox={false}>
      {
        entries.map(({ time, user, event }) => (
          <TableRow hoverable key={`${time} ${user} ${event}`}>
            <TableRowColumn>{formatDate(time)}</TableRowColumn>
            <TableRowColumn><a href="#TODO">{user}</a></TableRowColumn>
            <TableRowColumn>{event}</TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
));

const ErrorMessage = compose(
  setPropTypes({
    error: PT.shape({
      message: PT.string,
    }).isRequired,
  }),
  setDisplayName('Admin.PackageAudit.Error'),
)(({ error }) => (
  <p>Error: {error.message}</p>
));

export default compose(
  setPropTypes({
    onClose: PT.func.isRequired,
    handle: PT.string,
    status: apiStatus,
    response: PT.any,
  }),
  setDisplayName('Admin.PackageAudit'),
// eslint-disable-next-line object-curly-newline
)(({ onClose, handle, status, response }) => (
  <Dialog
    title="Package Audit"
    actions={[
      <FlatButton
        label="Close"
        primary
        onClick={onClose}
      />,
    ]}
    contentStyle={{ width: '80%', maxWidth: 'none' }}
    autoScrollBodyContent
    modal
    open={!!handle}
  >
    {
      branch(status, {
        [api.WAITING]: () => <Working />,
        [api.ERROR]: () => <ErrorMessage error={response} />,
        [api.SUCCESS]: () => <AuditTable entries={response} />,
      })
    }
  </Dialog>
));

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

import { branch } from './util';

const AuditTable = compose(
  setPropTypes({
    entries: PT.arrayOf(
      PT.shape({
        //TODO
        time: PT.any, //TODO
        handle: PT.string.isRequired,
        event: PT.string.isRequired, //TODO: oneOf?
      }).isRequired
    ).isRequired,
  }),
  setDisplayName('Admin.MemberAudit.Table'),
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
            <TableRowColumn>{time}</TableRowColumn>
            <TableRowColumn><a href="#TODO">{handle}</a></TableRowColumn>
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
  setDisplayName('Admin.MemberAudit.Error'),
)(({ error }) => (
  <p>Error: {error.message}</p>
));

export default compose(
  setPropTypes({
    onClose: PT.func.isRequired,
    open: PT.bool.isRequired,
    status: apiStatus.isRequired,
    response: PT.any,
  }),
  setDisplayName('Admin.MemberAudit'),
)(({ onClose, open, status, entries }) => (
  <Dialog
    title="User Audit"
    actions={[
      <FlatButton
        label="Close"
        primary
        onClick={onClose}
      />,
    ]}
    contentStyle={{ width: '80%', maxWidth: 'none' }}
    modal
    open={open}
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

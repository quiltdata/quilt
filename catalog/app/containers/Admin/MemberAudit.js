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
import ErrorMessage from './ErrorMessage';

const AuditTable = compose(
  setPropTypes({
    entries: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        time: PT.number.isRequired,
        handle: PT.string.isRequired,
        event: PT.string.isRequired,
      }).isRequired
    ).isRequired, // eslint-disable-line function-paren-newline
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
            <TableRowColumn>{formatDate(time)}</TableRowColumn>
            <TableRowColumn><a href="#TODO">{handle}</a></TableRowColumn>
            <TableRowColumn>{event}</TableRowColumn>
          </TableRow>
        ))
      }
    </TableBody>
  </Table>
));

export default compose(
  setPropTypes({
    onClose: PT.func.isRequired,
    name: PT.string,
    status: apiStatus,
    response: PT.any,
  }),
  setDisplayName('Admin.MemberAudit'),
// eslint-disable-next-line object-curly-newline
)(({ onClose, name, status, response }) => (
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
    autoScrollBodyContent
    modal
    open={!!name}
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

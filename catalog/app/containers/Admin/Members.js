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
import React, { Fragment } from 'react';
import { FormattedMessage as FM, injectIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { compose, setPropTypes, setDisplayName } from 'recompose';

import { withPagination } from 'components/Pagination';
import Spinner from 'components/Spinner';
import Badge from 'components/VisibilityIcon';
import api, { apiStatus } from 'constants/api';

import AddMember from './AddMember';
import msg from './messages';
import { branch, formatActivity, formatDate, withStatefulActions } from './util';
import ErrorMessage from './ErrorMessage';
import Cell from './LockableCell';
import SettingsMenu from './SettingsMenu';


const memberActivities = [
  'packages',
  'installs',
  'previews',
];

const MembersTable = compose(
  injectIntl,
  setPropTypes({
    user: PT.string.isRequired,
    audit: PT.func.isRequired,
    members: PT.arrayOf( // eslint-disable-line function-paren-newline
      PT.shape({
        name: PT.string.isRequired,
        lastSeen: PT.string,
        status: PT.oneOf(['active', 'disabled']).isRequired,
      }).isRequired,
    ).isRequired, // eslint-disable-line function-paren-newline
    actions: PT.shape({
      enable: PT.func.isRequired,
      disable: PT.func.isRequired,
      resetPassword: PT.func.isRequired,
    }).isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  withStatefulActions(({ intl: { formatMessage }, user, ...props }) => ({ name, status }) =>
    status === 'active'
      ? [
        {
          text: formatMessage(msg.membersDisable),
          callback: () => props.disable(name),
          disabled: user === name,
        },
        'divider',
        { text: formatMessage(msg.membersResetPassword), callback: () => props.resetPassword(name) },
      ]
      : [
        { text: formatMessage(msg.membersEnable), callback: () => props.enable(name) },
      ]
  ), // eslint-disable-line function-paren-newline
  withPagination({ key: 'members', getItemId: (m) => m.name }),
  setDisplayName('Admin.Members.Table'),
)(({
  audit,
  members,
  bindActions,
  pending,
  intl: { formatMessage },
  pagination,
}) => (
  <Fragment>
    <Table selectable={false}>
      <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
        <TableRow>
          <TableHeaderColumn style={{ paddingLeft: '48px' }}><FM {...msg.membersName} /></TableHeaderColumn>
          <TableHeaderColumn><FM {...msg.membersActivity} /></TableHeaderColumn>
          <TableHeaderColumn><FM {...msg.membersLastSeen} /></TableHeaderColumn>
        </TableRow>
      </TableHeader>
      <TableBody displayRowCheckbox={false} showRowHover>
        {members.length
          // eslint-disable-next-line object-curly-newline
          ? members.map(({ name, status, lastSeen, ...activity }) => (
            <TableRow key={name}>
              <Cell
                locked={pending[name]}
                style={{
                  paddingLeft: 0,
                }}
              >
                <SettingsMenu
                  actions={bindActions({ name, status })}
                  busy={pending[name]}
                  style={{
                    verticalAlign: 'middle',
                  }}
                  buttonProps={{
                    // adjustments to keep the table row at 48px height
                    style: {
                      height: '46px',
                      paddingTop: '10px',
                      paddingBottom: '10px',
                    },
                  }}
                />
                <Link
                  to={`/user/${name}`}
                  style={{
                    verticalAlign: 'middle',
                    opacity: status === 'disabled' ? 0.5 : undefined,
                  }}
                >
                  {name}
                </Link>
                {' '}
                {status === 'disabled'
                  ? <Badge label={formatMessage(msg.membersDisabled)} />
                  : null
                }
              </Cell>
              <Cell locked={pending[name]}>
                <FlatButton onClick={() => audit(name)}>
                  {formatActivity(memberActivities, activity)}
                </FlatButton>
              </Cell>
              <Cell locked={pending[name]}>{formatDate(lastSeen)}</Cell>
            </TableRow>
          ))
          : (
            <TableRow>
              <TableRowColumn colSpan={3}><FM {...msg.membersEmpty} /></TableRowColumn>
            </TableRow>
          )
        }
      </TableBody>
    </Table>
    {pagination}
  </Fragment>
));

export default compose(
  setPropTypes({
    status: apiStatus,
    response: PT.oneOfType([
      PT.array,
      PT.object,
    ]),
    actions: PT.object.isRequired,
    addMember: PT.func.isRequired,
    audit: PT.func.isRequired,
  }),
  setDisplayName('Admin.Members'),
)(({
  status,
  response,
  actions,
  addMember,
  audit,
  ...props
}) => (
  <Fragment>
    <h2>
      <FM {...msg.teamMembers} />
      {
        branch(status, {
          [api.WAITING]: () => <Spinner />,
          [api.SUCCESS]: () => ` (${response.length})`,
        })
      }
    </h2>
    {
      branch(status, {
        [api.SUCCESS]: () => (
          <MembersTable
            members={response}
            audit={audit}
            actions={actions}
            {...props}
          />
        ),
        [api.ERROR]: () => <ErrorMessage error={response} />,
      })
    }
    <AddMember addMember={addMember} />
  </Fragment>
));

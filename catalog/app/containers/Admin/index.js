/* Admin */
import Checkbox from 'material-ui/Checkbox';
import PT from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { FormattedMessage as FM, injectIntl } from 'react-intl';
import {
  compose,
  lifecycle,
  setDisplayName,
  setPropTypes,
  withHandlers,
  withProps,
} from 'recompose';

import { push } from 'containers/Notifications/actions';
import config from 'constants/config';

import * as actions from './actions';
import messages from './messages';
import selector from './selectors';
import AddMember from './AddMember';
import AuditDialog from './AuditDialog';
import Members from './Members';
import MemberAudit from './MemberAudit';
import Packages from './Packages';
import PackageAudit from './PackageAudit';


const teamName = config.team && config.team.name;

const dispatchPromise = (actionCreator, ...args) =>
  new Promise((resolve, reject) => actionCreator(...args, { resolve, reject }));

export default compose(
  injectIntl,
  connect(selector, { pushNotification: push, ...actions }),
  setPropTypes({
    addMember: PT.func.isRequired,
    members: PT.object.isRequired,
    getMembers: PT.func.isRequired,
    memberAudit: PT.object.isRequired,
    getMemberAudit: PT.func.isRequired,
    removeMember: PT.func.isRequired,
    resetMemberPassword: PT.func.isRequired,
    packages: PT.object.isRequired,
    getPackages: PT.func.isRequired,
    packageAudit: PT.object.isRequired,
    getPackageAudit: PT.func.isRequired,
    pushNotification: PT.func.isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  lifecycle({
    componentWillMount() {
      this.props.getMembers();
      this.props.getPackages();
    },
  }),
  withHandlers({
    removeMember: ({ removeMember, pushNotification }) => (name) => {
      // TODO: use MUI Dialog, i18n
      // eslint-disable-next-line no-alert, no-restricted-globals
      if (!confirm(`Are you sure you want to delete user ${name}?`)) {
        return Promise.resolve();
      }

      return dispatchPromise(removeMember, name)
        .then(() => {
          pushNotification(<FM {...messages.removeUserSuccess} values={{ name }} />);
        })
        .catch(() => {
          pushNotification(<FM {...messages.removeUserError} values={{ name }} />);
        });
    },
    resetMemberPassword: ({ resetMemberPassword, pushNotification }) => (name) =>
      dispatchPromise(resetMemberPassword, name)
        .then(() => {
          pushNotification(<FM {...messages.resetUserPasswordSuccess} values={{ name }} />);
        })
        .catch(() => {
          pushNotification(<FM {...messages.resetUserPasswordError} values={{ name }} />);
        }),
  }),
  withProps(({ removeMember, resetMemberPassword }) => ({
    memberActions: {
      remove: removeMember,
      resetPassword: resetMemberPassword,
    },
  })),
  setDisplayName('Admin'),
)(({
  addMember,
  members,
  memberActions,
  getMemberAudit,
  memberAudit,
  packages,
  packageActions,
  getPackageAudit,
  packageAudit,
  intl: { formatMessage },
}) => (
  <div>
    <h1><FM {...messages.teamHeader} values={{ name: teamName.toUpperCase() }} /></h1>

    <h2><FM {...messages.teamPolicies} /></h2>
    <Checkbox checked label={<FM {...messages.membersRead} />} />
    <Checkbox checked={false} label={<FM {...messages.membersWrite} />} />

    <AddMember addMember={addMember} />

    <Members {...members} audit={getMemberAudit} actions={memberActions} />

    <Packages {...packages} audit={getPackageAudit} actions={packageActions} />

    <AuditDialog
      onClose={() => getMemberAudit(null)}
      title={`${formatMessage(messages.auditUser)}: ${memberAudit.name}`}
      component={MemberAudit}
      {...memberAudit}
    />

    <AuditDialog
      onClose={() => getPackageAudit(null)}
      title={`${formatMessage(messages.auditPackage)}: ${packageAudit.handle}`}
      component={PackageAudit}
      {...packageAudit}
    />
  </div>
));

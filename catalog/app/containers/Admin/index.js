/* Admin */
import Checkbox from 'material-ui/Checkbox';
import Divider from 'material-ui/Divider';
import FlatButton from 'material-ui/FlatButton';
import IconButton from 'material-ui/IconButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import PT from 'prop-types';
import React, { PureComponent, Fragment } from 'react';
import { connect } from 'react-redux';
import { FormattedMessage } from 'react-intl';
import TextField from 'material-ui/TextField';

import config from 'constants/config';

import * as actions from './actions';
import messages from './messages';
import selector from './selectors';
import Members from './Members';
import MemberAudit from './MemberAudit';
//import Packages from './Packages';
//import PackageAudit from './PackageAudit';


const teamName = config.team && config.team.name;

export default compose(
  connect(selector, actions),
  setPropTypes({
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
    deletePackage: PT.func.isRequired,
  }),
  lifecycle({
    componentWillMount() {
      this.props.getMembers();
      this.props.getPackages();
    },
  }),
  withProps(({ removeMember, resetMemberPassword, deletePackage }) => ({
    memberActions: {
      remove: removeMember,
      resetPassword: resetMemberPassword,
    },
    packageActions: {
      delete: deletePackage,
    },
  }),
  withState('auditedMember', 'setAuditedMember'),
  withState('auditedPackage', 'setAuditedPackage'),
  withHandlers({
    auditMember: ({
      setAuditedMember,
      setAuditedPackage,
      getMemberAudit,
      getPackageAudit,
    }) => (name) => {
      getMemberAudit(name);
      setAuditedMember(name);
      setAuditedPackage(false);
      getPackageAudit(false);
    },
    auditPackage: ({
      setAuditedPackage,
      setAuditedMember,
      getPackageAudit,
      getMemberAudit,
    }) => (handle) => {
      getPackageAudit(handle);
      setAuditedPackage(handle);
      setAuditedMember(false);
      getMemberAudit(false);
    },
  }),
  setDisplayName('Admin'),
)(({
  members,
  memberActions,
  auditMember,
  auditedMember,
  memberAudit,
  packages,
  packageActions,
  auditPackage,
  auditedPackage,
  packageAudit,
}) => (
  <div>
    <h1><FormattedMessage {...messages.teamHeader} values={{ name: teamName.toUpperCase() }} /></h1>

    <h2><FormattedMessage {...messages.teamPolicies} /></h2>
    <Checkbox checked label={<FormattedMessage {...messages.membersRead} />} />
    <Checkbox checked={false} label={<FormattedMessage {...messages.membersWrite} />} />

    <h2><FormattedMessage {...messages.membersAdd} /></h2>
    <TextField hintText="Email" />
    <FlatButton label="Add" />

    <Members {...members} auditMember={auditMember} actions={memberActions} />

    {/*
    <Packages {...packages} auditPackage={auditPackage} actions={packageActions} />
    */}

    <MemberAudit
      onClose={() => auditMember(false)}
      open={!!auditedMember}
      {...memberAudit}
    />

    {/*
    <PackageAudit
      onClose={() => auditPackage(false)}
      open={!!auditedPackage}
      {...packageAudit}
    />
    */}
  </div>
));

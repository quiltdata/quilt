/* Admin messages */
import { defineMessages } from 'react-intl';

export default defineMessages({
  membersAdd: {
    id: 'app.containers.Admin.membersAdd',
    defaultMessage: 'Add',
  },
  membersRead: {
    id: 'app.containers.Admin.membersRead',
    defaultMessage: 'Members can read public packages',
  },
  membersWrite: {
    id: 'app.containers.Admin.membersWrite',
    defaultMessage: 'Members can write public packages',
  },
  teamHeader: {
    id: 'app.containers.Admin.teamHeader',
    defaultMessage: 'Team {name}',
  },
  teamMembers: {
    id: 'app.containers.Admin.teamMembers',
    defaultMessage: 'Members',
  },
  teamPackages: {
    id: 'app.containers.Admin.teamMembers',
    defaultMessage: 'Packages',
  },
  teamPayment: {
    id: 'app.containers.Admin.teamPayment',
    defaultMessage: 'Status',
  },
  teamPolicies: {
    id: 'app.containers.Admin.teamPolicies',
    defaultMessage: 'Policies',
  },
  changePolicy: {
    id: 'app.containers.Admin.changePolicy',
    defaultMessage: 'Contact support@quiltdata.io to change these settings',
  },
  auditUser: {
    id: 'app.containers.Admin.auditUser',
    defaultMessage: 'User audit',
  },
  auditPackage: {
    id: 'app.containers.Admin.auditPackage',
    defaultMessage: 'Package audit',
  },
  disableUserConfirm: {
    id: 'app.containers.Admin.disableUserConfirm',
    defaultMessage: 'Are you sure you want to disable user {name}?',
  },
  disableUserSuccess: {
    id: 'app.containers.Admin.disableUserSuccess',
    defaultMessage: 'User {name} has been disabled',
  },
  disableUserError: {
    id: 'app.containers.Admin.disableUserError',
    defaultMessage: 'Error disabling user {name}',
  },
  enableUserSuccess: {
    id: 'app.containers.Admin.enableUserSuccess',
    defaultMessage: 'User {name} has been enabled',
  },
  enableUserError: {
    id: 'app.containers.Admin.enableUserError',
    defaultMessage: 'Error enabling user {name}',
  },
  resetUserPasswordSuccess: {
    id: 'app.containers.Admin.resetUserPasswordSuccess',
    defaultMessage: 'Password for user {name} has been reset',
  },
  resetUserPasswordError: {
    id: 'app.containers.Admin.resetUserPasswordError',
    defaultMessage: 'Error resetting password for user {name}',
  },
  defaultErrorMessage: {
    id: 'app.containers.Admin.defaultErrorMessage',
    defaultMessage: 'Something went wrong',
  },
  closeAuditDialog: {
    id: 'app.containers.Admin.closeAuditDialog',
    defaultMessage: 'Close',
  },
  addMemberFormErrorUniq: {
    id: 'app.containers.Admin.AddMember.formErrorUniq',
    defaultMessage: 'Username or email already taken',
  },
  addMemberFormErrorUsername: {
    id: 'app.containers.Admin.AddMember.formErrorUsername',
    defaultMessage: 'Username must start with a letter or underscore, and contain only alphanumeric characters and underscores',
  },
  addMemberUsername: {
    id: 'app.containers.Admin.AddMember.username',
    defaultMessage: 'Username',
  },
  addMemberUsernameRequired: {
    id: 'app.containers.Admin.AddMember.usernameRequired',
    defaultMessage: 'Enter a username',
  },
  addMemberUsernameInvalid: {
    id: 'app.containers.Admin.AddMember.usernameInvalid',
    defaultMessage: 'Enter a valid username',
  },
  addMemberEmail: {
    id: 'app.containers.Admin.AddMember.email',
    defaultMessage: 'Email',
  },
  addMemberEmailRequired: {
    id: 'app.containers.Admin.AddMember.emailRequired',
    defaultMessage: 'Enter an email address',
  },
  addMemberEmailInvalid: {
    id: 'app.containers.Admin.AddMember.emailInvalid',
    defaultMessage: 'Enter a valid email',
  },
  addMemberSubmit: {
    id: 'app.containers.Admin.AddMember.submit',
    defaultMessage: 'Add',
  },
  addMemberSuccess: {
    id: 'app.containers.Admin.AddMember.success',
    defaultMessage: 'User {name} ({email}) invited',
  },
  pkgHandle: {
    id: 'app.containers.Admin.Packages.handle',
    defaultMessage: 'Handle',
  },
  pkgActivity: {
    id: 'app.containers.Admin.Packages.activity',
    defaultMessage: 'Activity',
  },
  pkgLastModified: {
    id: 'app.containers.Admin.Packages.lastModified',
    defaultMessage: 'Last modified',
  },
  pkgEmpty: {
    id: 'app.containers.Admin.Packages.empty',
    defaultMessage: 'Nothing here yet',
  },
  pkgDeleted: {
    id: 'app.containers.Admin.Packages.deleted',
    defaultMessage: 'deleted',
  },
  membersName: {
    id: 'app.containers.Admin.Members.name',
    defaultMessage: 'Username',
  },
  membersActivity: {
    id: 'app.containers.Admin.Members.activity',
    defaultMessage: 'Activity',
  },
  membersLastSeen: {
    id: 'app.containers.Admin.Members.lastSeen',
    defaultMessage: 'Last seen',
  },
  membersEmpty: {
    id: 'app.containers.Admin.Members.empty',
    defaultMessage: 'No one here yet',
  },
  membersDisabled: {
    id: 'app.containers.Admin.Members.disabled',
    defaultMessage: 'disabled',
  },
  membersDisable: {
    id: 'app.containers.Admin.Members.disable',
    defaultMessage: 'Disable user',
  },
  membersEnable: {
    id: 'app.containers.Admin.Members.enable',
    defaultMessage: 'Enable user',
  },
  membersResetPassword: {
    id: 'app.containers.Admin.Members.resetPassword',
    defaultMessage: 'Reset password',
  },
  pkgAuditTime: {
    id: 'app.containers.Admin.PackageAudit.time',
    defaultMessage: 'Time',
  },
  pkgAuditUser: {
    id: 'app.containers.Admin.PackageAudit.user',
    defaultMessage: 'User',
  },
  pkgAuditEvent: {
    id: 'app.containers.Admin.PackageAudit.event',
    defaultMessage: 'Event',
  },
  pkgAuditEmpty: {
    id: 'app.containers.Admin.PackageAudit.empty',
    defaultMessage: 'Nothing here yet',
  },
  memberAuditTime: {
    id: 'app.containers.Admin.MemberAudit.time',
    defaultMessage: 'Time',
  },
  memberAuditPackage: {
    id: 'app.containers.Admin.MemberAudit.package',
    defaultMessage: 'Package',
  },
  memberAuditEvent: {
    id: 'app.containers.Admin.MemberAudit.event',
    defaultMessage: 'Event',
  },
  memberAuditEmpty: {
    id: 'app.containers.Admin.MemberAudit.empty',
    defaultMessage: 'Nothing here yet',
  },
});

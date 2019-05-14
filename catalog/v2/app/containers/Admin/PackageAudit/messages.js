import { defineMessages } from 'react-intl';

const scope = 'app.containers.Admin.PackageAudit';

export default defineMessages({
  heading: {
    id: `${scope}.heading`,
    defaultMessage: 'Package audit',
  },
  time: {
    id: `${scope}.time`,
    defaultMessage: 'Time',
  },
  user: {
    id: `${scope}.user`,
    defaultMessage: 'User',
  },
  event: {
    id: `${scope}.event`,
    defaultMessage: 'Event',
  },
  empty: {
    id: `${scope}.empty`,
    defaultMessage: 'Nothing here yet',
  },
});

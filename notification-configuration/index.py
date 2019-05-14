"""
Set up indexer notification on data bucket.

Remove notification on delete.
"""
import boto3

from t4_lambda_shared.cfnresponse import send, SUCCESS, FAILED

def set_mappings(params, *, delete=False):
    """ Sets up desired mappings after checking no mappings currently exist. """
    s3 = boto3.client('s3')
    if delete:
        # clear notifications
        params['NotificationConfiguration'] = {}
        s3.put_bucket_notification_configuration(**params)
        return

    existing = s3.get_bucket_notification_configuration(Bucket=params['Bucket'])
    notification_types = ['TopicConfigurations', 'QueueConfigurations', 'LambdaFunctionConfigurations']
    for ty in notification_types:
        if ty in existing:
            # Existing notification present. Check whether it's ours from a previous deploy
            if ty == 'TopicConfigurations':
                if len(existing['TopicConfigurations']) > 1:
                    raise Exception('Unable to attach notification. Multiple Topic notifications '
                            'present on bucket {}'.format(params['Bucket']))
                # If there's only one topic configuration and its arn matches our topic arn then
                # we can safely overwrite it
                try:
                    existing_arn = existing['TopicConfigurations'][0]['TopicArn']
                    new_arn = params['NotificationConfiguration']['TopicConfigurations'][0]['TopicArn']
                    if not existing_arn == new_arn:
                        raise Exception('Unable to attach notification. Existing '
                                'notification for a different topic on bucket ' + params['Bucket'])
                except KeyError:
                    raise Exception('Unable to attach notification. Existing topic configuration '
                            'present on bucket {}.'.format(params['Bucket']))
            else:
                raise Exception(('Unable to attach notification. Existing notification type {} present '
                    'on bucket {}').format(ty, params['Bucket']))

    s3.put_bucket_notification_configuration(**params)

def select_params(params):
    """ Grabs just the necessary keys from params """
    return {
        'Bucket': params['Bucket'],
        'NotificationConfiguration': params['NotificationConfiguration']
    }

def handler(event, context):
    """ Top-level handler for custom resource """
    print('Changing bucket notification settings')
    try:
        params = select_params(event['ResourceProperties'])
        current_resource_id = 'notification_' + params['Bucket']
        if event['RequestType'] == 'Create':
            set_mappings(params)
            send(event, context, SUCCESS, physical_resource_id=current_resource_id)
            return
        elif event['RequestType'] == 'Update':
            if event['PhysicalResourceId'] == current_resource_id:
                # do nothing if physical_resource_id is unchanged
                send(event, context, SUCCESS, physical_resource_id=current_resource_id)
                return
            # Otherwise, bucket name changed. Must set up new notification.
            set_mappings(params)
            # Also must delete old notification on old bucket.
            old_params = select_params(event['OldResourceProperties'])
            set_mappings(old_params, delete=True)
            # report success with new resource id
            send(event, context, SUCCESS, physical_resource_id=current_resource_id)
            return
        elif event['RequestType'] == 'Delete':
            # Stack is being deleted, so we clear notifications on the bucket.
            set_mappings(params, delete=True)
            send(event, context, SUCCESS, physical_resource_id=current_resource_id)
            return
        else:
            # unknown event type
            send(event, context, FAILED, physical_resource_id=current_resource_id,
                    reason='Unknown event type ' + event['RequestType'])
            return

    except Exception as e:
        print('Exception encountered')
        print(str(e))
        print(str(event))
        # TODO: send failure with error message
        send(event, context, FAILED, reason=str(e))
        raise

import os
from flask import request
from flask_mail import Mail, Message

from . import app

app.config['MAIL_SERVER'] = os.getenv('SMTP_HOST')
app.config['MAIL_USERNAME'] = os.getenv('SMTP_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('SMTP_PASSWORD')
app.config['MAIL_DEV'] = os.getenv('MAIL_DEV')
app.config['MAIL_USE_TLS'] = True

mail = Mail(app)

CATALOG_URL = app.config['CATALOG_URL']
DEFAULT_SENDER = app.config['DEFAULT_SENDER']
REGISTRY_HOST = app.config['REGISTRY_HOST']

def send_email(recipient, sender, subject, body, reply_to=None, dry_run=False):
    if reply_to is None:
        reply_to = sender

    message = Message(
            subject=subject, 
            recipients=[recipient], 
            html=body,
            sender=sender
            )

    if app.config['TESTING'] or app.config['MAIL_DEV'] or dry_run:
        print(message)
    else:
        mail.send(message)

def send_activation_email(user, activation_link):
    base = REGISTRY_HOST
    link = '{base}/activate/{link}'.format(base=base, link=activation_link)
    body = (
        '<head><title></title></head>'
        '<body>'
        '<p>You recently signed up for Quilt.</p>'
        '<p>To activate your account, <a href="{link}">click here in the next 24 hours.</a></p>'
        '<p>Sincerely, <a href="https://quiltdata.com">Quilt Data</a></p>'
        '</body>'
    ).format(link=link)
    send_email(user.email, DEFAULT_SENDER, 'Activate your Quilt account', body)

def send_reset_email(user, reset_link):
    base = CATALOG_URL
    link = '{base}/reset_password/{link}'.format(base=base, link=reset_link)
    body = (
        '<head><title></title></head>'
        '<body>'
        '<p>Your Quilt password has been reset.</p>'
        '<p>To set a new password, <a href="{link}">click here in the next 24 hours.</a></p>'
        '<p>Sincerely, <a href="https://quiltdata.com">Quilt Data</a></p>'
        '</body>'
    ).format(link=link)
    send_email(user.email, DEFAULT_SENDER, 'Reset your Quilt password', body)

def send_invitation_email(email, owner, package_name):
    body = (
        "{owner} shared data with you on Quilt.\n"
        "{owner}/{pkg}\n"
        "Sign up to access the data.\n"
    ).format(owner=owner, pkg=package_name)
    subject = "{owner} shared data with you on Quilt".format(owner=owner)
    try:
        send_email(recipient=email, body=body, sender=DEFAULT_SENDER, subject=subject)
        return {}
    except:
        raise ApiException(requests.codes.server_error, "Server error")

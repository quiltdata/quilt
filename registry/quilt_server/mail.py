import os
from flask import render_template, request
from flask_mail import Mail, Message

from . import app, db
from .models import User

app.config['MAIL_SERVER'] = os.getenv('SMTP_HOST')
app.config['MAIL_USERNAME'] = os.getenv('SMTP_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('SMTP_PASSWORD')
app.config['MAIL_DEV'] = os.getenv('MAIL_DEV')
app.config['MAIL_USE_TLS'] = True

mail = Mail(app)

CATALOG_URL = app.config['CATALOG_URL']
DEFAULT_SENDER = app.config['DEFAULT_SENDER']
REGISTRY_HOST = app.config['REGISTRY_HOST']

TEAM_ID = app.config['TEAM_ID']
TEAM_NAME = app.config['TEAM_NAME']

def send_email(recipient, sender, subject, html, body=None, reply_to=None, dry_run=False):
    if reply_to is None:
        reply_to = sender

    if not isinstance(recipient, list):
        recipient = [recipient]

    message = Message(
            subject=subject, 
            recipients=recipient, 
            html=html,
            body=body,
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
    send_email(recipient=user.email, sender=DEFAULT_SENDER,
            subject='Activate your Quilt account', html=body)

def send_reset_email(user, reset_link):
    base = CATALOG_URL
    link = '{base}/reset_password/{link}'.format(base=base, link=reset_link)
    html_body = render_template('reset_pw_email.html', link=link, team=TEAM_NAME)
    text_body = render_template('reset_pw_email.txt', link=link)
    send_email(recipient=user.email, sender=DEFAULT_SENDER,
            subject='Reset your Quilt password', html=html_body, body=text_body)

def send_invitation_email(email, owner, package_name):
    body = (
        "{owner} shared data with you on Quilt.\n"
        "{owner}/{pkg}\n"
        "Sign up to access the data.\n"
    ).format(owner=owner, pkg=package_name)
    subject = "{owner} shared data with you on Quilt".format(owner=owner)
    try:
        send_email(recipient=email, html=body, sender=DEFAULT_SENDER, subject=subject)
    except:
        raise ApiException(requests.codes.server_error, "Server error")

def send_user_signup_email(username, email):
    recipients = (
        db.session.query(
            User.email
        ).filter(User.is_admin == True)
        .all()
    )
    recipients = [r[0] for r in recipients] # flatten out tuples
    return {}

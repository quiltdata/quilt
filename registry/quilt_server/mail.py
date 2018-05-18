import os
from flask_mail import Mail, Message

from . import app

mail = Mail(app)

SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_USER = os.getenv('SMTP_USERNAME')
SMTP_PASS = os.getenv('SMTP_PASSWORD')

def send_email(recipient, sender, subject, body, reply_to=None, dry_run=False):
    if reply_to is None:
        reply_to = sender

    message = Message(
            subject=subject, 
            recipients=[recipient], 
            html=body,
            sender=sender
            )

    if app.config['TESTING'] or dry_run:
        # TODO: prettify print
        print(message)
    else:
        mail.send(message)

# TODO: fix configs so registry can actually send emails
# TODO: make SMTP connection secure: TLS, SSL, etc

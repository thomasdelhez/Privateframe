import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("privateframe.email")


def send_email(*, recipient: str, subject: str, body: str) -> None:
    settings = get_settings()
    if settings.email_backend == "console":
        logger.warning("E-mail voor %s\nOnderwerp: %s\n\n%s", recipient, subject, body)
        return

    if settings.email_backend != "smtp":
        raise RuntimeError(f"Onbekende e-mailbackend: {settings.email_backend}")

    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as client:
        client.send_message(message)

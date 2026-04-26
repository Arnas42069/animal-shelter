import os
import logging
import smtplib
from email.message import EmailMessage
from datetime import datetime

logger = logging.getLogger(__name__)


SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT") or 587)
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER or "no-reply@example.com")


def build_pending_visit_email(
    shelter_name: str,
    volunteer_name: str,
    volunteer_email: str | None,
    start_at: datetime,
    end_at: datetime,
    note: str | None,
):
    subject = "Nauja savanorystės registracija laukia patvirtinimo"

    body = f"""
Sveiki, {shelter_name},

Gavote naują savanorystės registraciją.

Savanoris: {volunteer_name}
El. paštas: {volunteer_email or "Nenurodytas"}
Laikas: {start_at.strftime("%Y-%m-%d %H:%M")} - {end_at.strftime("%Y-%m-%d %H:%M")}
Pastaba: {note or "Nėra"}

Registracijos statusas: pending

Prisijunkite prie sistemos ir patvirtinkite arba atmeskite registraciją.

Pagarbiai,
Gyvūnų prieglaudų sistema
""".strip()

    return subject, body


def send_email(to_email: str, subject: str, body: str) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP nesukonfigūruotas. Email būtų išsiųstas į: %s", to_email)
        logger.warning("Subject: %s", subject)
        logger.warning("Body:\n%s", body)
        return

    message = EmailMessage()
    message["From"] = EMAIL_FROM
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)

    except Exception:
        logger.exception("Failed to send email notification to %s", to_email)
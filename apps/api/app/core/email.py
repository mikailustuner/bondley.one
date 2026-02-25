import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

async def send_verification_email(to_email: str, verify_url: str):
    """
    Asynchronously sends an email verification link using aiosmtplib.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning(
            "SMTP_HOST or SMTP_USER environment variables are not set. "
            f"Email to {to_email} will not be sent. Verification URL: {verify_url}"
        )
        return

    msg = MIMEMultipart("alternative")
    msg['Subject'] = "FinCalc - E-Posta Adresinizi Doğrulayın"
    msg['From'] = f"FinCalc <{settings.SMTP_USER}>"
    msg['To'] = to_email

    text = f"Merhaba, lütfen hesabınızı doğrulamak için şu linke tıklayın: {verify_url}"
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
            <h2 style="color: #2563eb;">FinCalc'a Hoş Geldiniz!</h2>
            <p>Kayıt olduğunuz için teşekkür ederiz. Hesabınızı güvenle kullanmaya başlamak için lütfen e-posta adresinizi doğrulayın.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verify_url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Hesabımı Doğrula</a>
            </div>
            <p style="font-size: 14px; color: #666;">Eğer butona tıklayamıyorsanız, aşağıdaki linki kopyalayıp tarayıcınıza yapıştırabilirsiniz:</p>
            <p style="font-size: 12px; color: #999; word-break: break-all;">{verify_url}</p>
            <hr style="border: none; border-top: 1px solid #eaeaea; margin-top: 30px;" />
            <p style="font-size: 12px; color: #aaa; text-align: center;">Bu e-posta otomatik olarak gönderilmiştir, lütfen cevaplamayınız.</p>
        </div>
      </body>
    </html>
    """

    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    msg.attach(part1)
    msg.attach(part2)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            use_tls=(settings.SMTP_PORT == 465),
            start_tls=(settings.SMTP_PORT == 587),
        )
        logger.info(f"Verification email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {to_email}: {e}")
        # Not raising an exception here to avoid breaking the registration flow.
        # Logging it allows admins to track failures.

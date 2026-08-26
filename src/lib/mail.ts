import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!transport) {
    // ponytail: single shared SMTP URL; per-channel config arrives with M15 Notifications
    transport = nodemailer.createTransport(process.env.SMTP_URL ?? "smtp://localhost:1025");
  }
  return transport;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  await getTransport().sendMail({
    from: process.env.MAIL_FROM ?? "Vanguard <noreply@vanguard.local>",
    to,
    subject,
    text,
  });
}

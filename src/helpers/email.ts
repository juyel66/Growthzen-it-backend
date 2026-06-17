import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
}

const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailFrom = process.env.EMAIL_FROM;
  const emailHost = process.env.EMAIL_HOST ?? "smtp.gmail.com";
  const emailPort = Number(process.env.EMAIL_PORT) || 587;

  if (!emailUser || !emailPass || !emailFrom) {
    console.info(`[DEV EMAIL] To: ${options.to}`);
    console.info(`[DEV EMAIL] Subject: ${options.subject}`);
    console.info(`[DEV EMAIL] Message: ${options.text}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: emailHost,
    port: emailPort,
    secure: emailPort === 465,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  await transporter.sendMail({
    from: emailFrom,
    to: options.to,
    subject: options.subject,
    text: options.text,
  });
};

export default sendEmail;
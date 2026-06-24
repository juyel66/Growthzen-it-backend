import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const sendEmail = async (options: SendEmailOptions): Promise<void> => {

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailFrom = process.env.EMAIL_FROM;
  const emailHost = process.env.EMAIL_HOST ?? "smtp.gmail.com";
  const emailPort = Number(process.env.EMAIL_PORT) || 587;



  console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
console.log("EMAIL_PASS EXISTS:", !!process.env.EMAIL_PASS);
console.log("Sending email to:", options.to);



  if (!emailUser || !emailPass || !emailFrom) {
    throw new Error("Email configuration is incomplete");
  }

  try {

    
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
      html: options.html,
    });

 } catch (error) {
  console.error("EMAIL ERROR:", error);

  const message =
    error instanceof Error ? error.message : "Failed to send email";

  throw new Error(message);
}
};

export default sendEmail;
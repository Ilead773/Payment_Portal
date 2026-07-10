import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private prisma: PrismaService) {}

  private get apiKey(): string | undefined {
    return process.env.BREVO_API_KEY;
  }

  private get isTestMode(): boolean {
    const mode = process.env.BREVO_TEST_MODE;
    return mode ? mode.toLowerCase() === 'true' : false;
  }

  private get testRedirectEmail(): string {
    return process.env.BREVO_TEST_REDIRECT_EMAIL || 'shahithu2004@gmail.com';
  }

  private async sendMail(toEmail: string, toName: string, subject: string, htmlContent: string): Promise<boolean> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      this.logger.warn('Brevo API key is not configured. Skipping email send.');
      return false;
    }

    let finalRecipientEmail = toEmail;
    let finalRecipientName = toName;

    if (this.isTestMode) {
      this.logger.log(`Test mode active. Redirecting email from ${toEmail} to ${this.testRedirectEmail}`);
      finalRecipientEmail = this.testRedirectEmail;
      finalRecipientName = `Test Redirect (${toName})`;
    }

    const payload = {
      sender: {
        name: 'iLead Payment Portal',
        email: 'noreply@ilead.edu.in',
      },
      to: [
        {
          email: finalRecipientEmail,
          name: finalRecipientName,
        },
      ],
      subject,
      htmlContent,
    };

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`Failed to send email to ${finalRecipientEmail} via Brevo. Status: ${response.status}. Error: ${errText}`);
        return false;
      }

      this.logger.log(`Email successfully sent to ${finalRecipientEmail} via Brevo. Subject: "${subject}"`);
      return true;
    } catch (error: any) {
      this.logger.error(`Exception while sending email via Brevo: ${error.message}`, error.stack);
      return false;
    }
  }

  async sendWelcomeEmail(user: { name: string; email: string }, rawPassword: string): Promise<boolean> {
    const subject = 'Welcome to iLead Payment Portal - Your Login Credentials';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <h2 style="color: #2563eb; margin-top: 0;">Welcome to iLead Staff Registry</h2>
        <p>Dear <strong>${user.name}</strong>,</p>
        <p>An administrative workspace profile has been registered for you on the iLead Payment Portal.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #495057;">Your Account Credentials:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #6c757d; font-weight: bold; width: 120px;">Portal Link:</td>
              <td style="padding: 4px 0; color: #212529;"><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: #2563eb;">iLead Payment Portal</a></td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6c757d; font-weight: bold;">Login Email:</td>
              <td style="padding: 4px 0; color: #212529; font-family: monospace; font-weight: bold;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #6c757d; font-weight: bold;">Password:</td>
              <td style="padding: 4px 0; color: #212529; font-family: monospace; font-weight: bold;">${rawPassword}</td>
            </tr>
          </table>
        </div>

        <p style="color: #ef4444; font-size: 12px; font-weight: bold;">Important Security Notice:</p>
        <p style="font-size: 12px; color: #6b7280; margin-bottom: 20px;">
          Do not share this email or your password with anyone. We recommend changing your password after your initial sign-in.
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
          This is an automated notification. Please do not reply directly to this email.
        </p>
      </div>
    `;

    return this.sendMail(user.email, user.name, subject, htmlContent);
  }

  async sendPaymentReceiptEmail(
    student: { name: string; email?: string | null },
    payment: { amount: number; paymentDate: Date },
    semesterPlan: { semesterNumber: number; feeAmount: number }
  ): Promise<boolean> {
    if (!student.email) {
      this.logger.warn(`Skipping payment receipt email for student ${student.name} because they have no email ID configured.`);
      return false;
    }

    const formatCurrency = (amt: number) => {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
    };

    const subject = `Payment Receipt - Semester ${semesterPlan.semesterNumber} - iLead Portal`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <h2 style="color: #10b981; margin-top: 0;">Payment Receipt Confirmation</h2>
        <p>Dear <strong>${student.name}</strong>,</p>
        <p>Thank you for your payment. We have successfully recorded your fee transaction details.</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #495057;">Transaction Summary:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-weight: bold; width: 150px;">Semester Applied:</td>
              <td style="padding: 6px 0; color: #212529; font-weight: bold;">Semester ${semesterPlan.semesterNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-weight: bold;">Amount Paid:</td>
              <td style="padding: 6px 0; color: #10b981; font-weight: bold; font-size: 16px;">${formatCurrency(payment.amount)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-weight: bold;">Transaction Date:</td>
              <td style="padding: 6px 0; color: #212529;">${new Date(payment.paymentDate).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6c757d; font-weight: bold;">Semester Fee:</td>
              <td style="padding: 6px 0; color: #212529;">${formatCurrency(semesterPlan.feeAmount)}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 12px; color: #4b5563;">
          If you have any questions regarding this receipt or require a formal stamped copy, please contact the accounts office.
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
          This is an automated notification. Please do not reply directly to this email.
        </p>
      </div>
    `;

    return this.sendMail(student.email, student.name, subject, htmlContent);
  }

  async sendFeeReminderEmail(
    student: { name: string; email: string },
    semesterPlan: { semesterNumber: number; feeAmount: number; dueAmount: number; dueDate: Date }
  ): Promise<boolean> {
    const formatCurrency = (amt: number) => {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
    };

    const subject = `Fee Payment Reminder - Semester ${semesterPlan.semesterNumber} - iLead Portal`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <h2 style="color: #ea580c; margin-top: 0;">Fee Payment Reminder</h2>
        <p>Dear <strong>${student.name}</strong>,</p>
        <p>This is a reminder that the tuition fee for <strong>Semester ${semesterPlan.semesterNumber}</strong> is due on <strong>${new Date(semesterPlan.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>
        
        <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; border: 1px solid #ffedd5; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #c2410c;">Fee Details:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #9a3412; font-weight: bold; width: 150px;">Semester:</td>
              <td style="padding: 6px 0; color: #212529; font-weight: bold;">Semester ${semesterPlan.semesterNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #9a3412; font-weight: bold;">Total Fee:</td>
              <td style="padding: 6px 0; color: #212529;">${formatCurrency(semesterPlan.feeAmount)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #9a3412; font-weight: bold;">Outstanding Due:</td>
              <td style="padding: 6px 0; color: #ea580c; font-weight: bold; font-size: 16px;">${formatCurrency(semesterPlan.dueAmount)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #9a3412; font-weight: bold;">Due Date:</td>
              <td style="padding: 6px 0; color: #c2410c; font-weight: bold;">${new Date(semesterPlan.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 12px; color: #4b5563;">
          Please ensure the outstanding amount is cleared on or before the due date to avoid any late registration penalties. If you have already paid or if this reminder was sent in error, please contact the accounts office.
        </p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
          This is an automated notification. Please do not reply directly to this email.
        </p>
      </div>
    `;

    return this.sendMail(student.email, student.name, subject, htmlContent);
  }

  async sendCustomEmails(
    studentIds: string[],
    subject: string,
    message: string
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [] as string[],
    };

    const htmlMessage = message.replace(/\n/g, '<br/>');

    const students = await this.prisma.client.student.findMany({
      where: {
        id: { in: studentIds },
        deletedAt: null,
      },
    });

    for (const student of students) {
      if (!student.email) {
        results.failedCount++;
        results.errors.push(`Student "${student.name}" has no email address configured.`);
        continue;
      }

      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #2563eb; margin-top: 0; font-family: Outfit, sans-serif;">Notification from iLead</h2>
          <p>Dear <strong>${student.name}</strong>,</p>
          <div style="color: #374151; line-height: 1.6; margin: 20px 0; font-size: 14px;">
            ${htmlMessage}
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
            This is an automated notification. Please do not reply directly to this email.
          </p>
        </div>
      `;

      const success = await this.sendMail(student.email, student.name, subject, htmlContent);
      if (success) {
        results.successCount++;
      } else {
        results.failedCount++;
        results.errors.push(`Failed to send email to ${student.name} (${student.email}) via Brevo API.`);
      }
    }

    return results;
  }
}

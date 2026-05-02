// lib/email/templates.ts

import { type DeadManSwitchWarningStage, getDeadManSwitchWarningCopy } from '@/lib/deadManSwitch';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getSignupConfirmationEmail(
  email: string,
  confirmationLink: string
): string {
  const safeEmail = escapeHtml(email);
  const safeConfirmationLink = escapeHtml(confirmationLink);

  return `
    <div style="margin:0; padding:48px 20px; background:#f4efe6; font-family: Georgia, serif; color:#4f4338;">
      <div style="max-width:640px; margin:0 auto; background:#fcfaf5; border:1px solid #ddd0bf; overflow:hidden; box-shadow:0 10px 30px rgba(79, 67, 56, 0.06);">
        <div style="padding:16px 28px; background:#f0e7da; border-bottom:1px solid #ddd0bf; text-align:center;">
          <p style="margin:0; font-size:11px; letter-spacing:0.28em; text-transform:uppercase; color:#8d7765;">ULUMAE</p>
        </div>

        <div style="padding:48px 36px 30px;">
          <p style="margin:0 0 14px; font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:#9a8572;">Confirm your account</p>
          <h1 style="margin:0; font-size:38px; line-height:1.08; font-weight:400; color:#4f4338;">
            Preserve your place
            <span style="display:block; font-style:italic; color:#7b8a63;">inside ULUMAE</span>
          </h1>

          <p style="margin:26px 0 0; font-size:17px; line-height:1.8; color:#5e5145;">
            Your account is almost ready. Confirm your email address to activate access and continue the archive journey you just began.
          </p>

          <div style="margin:28px 0 0; padding:18px 20px; background:#f7f2ea; border:1px solid #e3d7c8;">
            <p style="margin:0; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#9a8572;">Email address</p>
            <p style="margin:10px 0 0; font-size:16px; line-height:1.6; color:#4f4338; word-break:break-word;">${safeEmail}</p>
          </div>

          <div style="margin:34px 0 0; text-align:center;">
            <a href="${safeConfirmationLink}" style="display:inline-block; padding:16px 32px; background:#667552; color:#fcfaf5; text-decoration:none; border:1px solid #667552; font-size:13px; letter-spacing:0.16em; text-transform:uppercase;">
              Confirm my account
            </a>
          </div>

          <p style="margin:28px 0 0; font-size:14px; line-height:1.8; color:#7a6a5c; text-align:center;">
            If the button does not open, copy and paste this link into your browser:
          </p>
          <p style="margin:12px 0 0; font-size:13px; line-height:1.7; word-break:break-all; text-align:center;">
            <a href="${safeConfirmationLink}" style="color:#667552; text-decoration:underline;">${safeConfirmationLink}</a>
          </p>
        </div>

        <div style="padding:24px 36px 34px; border-top:1px solid #e7dccd; background:#f8f4ec;">
          <p style="margin:0; font-size:13px; line-height:1.8; color:#7a6a5c; text-align:center;">
            You received this message because someone used this email address to create a ULUMAE account.
          </p>
        </div>
      </div>
    </div>
  `;
}

export function getWitnessInvitationEmail(
  inviterName: string,
  deceasedName: string,
  inviteLink: string,
  personalMessage?: string
): string {
  return `
    <div style="background-color: #f4f1ea; padding: 50px; font-family: 'Georgia', serif; color: #5a6b78; line-height: 1.8;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #fdfbf7; padding: 60px; border: 1px solid #e8d8cc; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        
        <div style="text-align: center; margin-bottom: 40px;">
          <h2 style="font-weight: normal; font-style: italic; color: #d4958a; margin: 0; font-size: 24px;">An Invitation to Bear Witness</h2>
        </div>

        <p style="font-size: 16px; margin-bottom: 25px;">
          ${inviterName} has entrusted you with a portion of the memory of 
          <strong style="color: #5a6b78;">${deceasedName}</strong>.
        </p>

        <p style="font-size: 16px; margin-bottom: 25px; font-style: italic; border-left: 3px solid #89b896; padding-left: 20px; color: #555;">
          "This is not a request for photos. This is an invitation to bear witness. Your contribution will become part of the permanent historical archives."
        </p>

        ${personalMessage ? `
        <div style="margin: 30px 0; padding: 20px; background-color: #fdf6f0; border: 1px dashed #e8d8cc; font-size: 15px;">
          <strong>Message from ${inviterName}:</strong><br/>
          ${personalMessage}
        </div>
        ` : ''}

        <div style="text-align: center; margin-top: 50px;">
          <a href="${inviteLink}" style="background-color: #5a6b78; color: #fdf6f0; padding: 18px 35px; text-decoration: none; border-radius: 2px; font-size: 14px; letter-spacing: 0.1em; display: inline-block; text-transform: uppercase;">
            Accept and Bear Witness
          </a>
        </div>

        <div style="margin-top: 60px; padding-top: 30px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999;">
          <p>This invitation was sent by ULUMAE on behalf of the family.</p>
          <p>Preserving the essence of a life, forever.</p>
        </div>
      </div>
    </div>
  `;
}


export function getSuccessorInvitationEmail(
  ownerName: string,
  successorName: string,
  acceptLink: string
): string {
  return `
    <div style="background-color: #f4f1ea; padding: 50px; font-family: 'Georgia', serif; color: #5a6b78; line-height: 1.8;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 60px; border: 2px solid #5a6b78; border-radius: 4px;">
        
        <div style="text-align: center; margin-bottom: 40px;">
          <h2 style="font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; font-size: 18px; color: #5a6b78; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
            ULUMAE Stewardship
          </h2>
        </div>

        <p style="font-size: 16px;">Dear ${successorName},</p>

        <p style="font-size: 16px;">
          <strong>${ownerName}</strong> has designated you as their <strong>Archive Steward</strong>.
        </p>

        <p style="font-size: 16px;">
          This is a position of significant trust. It means that in the event of their passing, you will be granted full control and legal authority over their family archives stored within ULUMAE.
        </p>

        <div style="background-color: #f8f9fa; padding: 20px; margin: 30px 0; font-size: 14px; border-left: 4px solid #5a6b78;">
          <strong>Responsibilities include:</strong>
          <ul style="margin-top: 10px; padding-left: 20px;">
            <li>Preserving the family history</li>
            <li>Managing access for future generations</li>
            <li>Resolving any disputes regarding content</li>
          </ul>
        </div>

        <p style="font-size: 16px;">
          To accept this responsibility, please confirm your identity below.
        </p>

        <div style="text-align: center; margin-top: 40px;">
          <a href="${acceptLink}" style="background-color: #5a6b78; color: #ffffff; padding: 16px 30px; text-decoration: none; font-family: sans-serif; font-weight: bold; font-size: 14px;">
            I Accept This Responsibility
          </a>
        </div>

      </div>
    </div>
  `;
}

export function getProofOfLifeEmail(userName: string, checkInLink: string): string {
  return `
    <div style="background-color: #fdf6f0; padding: 40px; font-family: sans-serif; color: #5a6b78;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #e8d8cc;">
        <h2 style="font-family: serif; color: #5a6b78; font-size: 24px; margin-bottom: 20px;">
          ULUMAE: Annual Verification
        </h2>
        <p>Dear ${userName},</p>
        <p>
          This is your annual check-in from ULUMAE. You have enabled the 
          <strong>Dead Man's Switch</strong> for your archive.
        </p>
        <p>
          We are verifying that you are still active and in control of your account. 
          If you do not respond within <strong>90 days</strong>, we will notify your designated successor.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${checkInLink}" style="background-color: #89b896; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            I am here - Reset Timer
          </a>
        </div>
        <p style="font-size: 12px; color: #999;">
          If you no longer wish to receive these checks, you can disable this feature in your account settings.
        </p>
      </div>
    </div>
  `;
}

export function getDeadManSwitchWarningEmail(
  userName: string,
  confirmLink: string,
  stage: DeadManSwitchWarningStage
): string {
  const copy = getDeadManSwitchWarningCopy(stage);

  return `
    <div style="background-color: #fdf6f0; padding: 40px; font-family: sans-serif; color: #5a6b78;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border: 1px solid #e8d8cc;">
        <h2 style="font-family: serif; color: #5a6b78; font-size: 24px; margin-bottom: 20px;">
          Dead Man's Switch warning
        </h2>
        <p>Dear ${userName},</p>
        <p>${copy.title}</p>
        <p>${copy.body}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmLink}" style="background-color: #89b896; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            ${copy.buttonLabel}
          </a>
        </div>
        <p style="font-size: 12px; color: #999;">
          Confirming activity will reset the transfer countdown from today.
        </p>
      </div>
    </div>
  `;
}

// Step 1.1.4: Gentle reminder email — no urgency, no guilt
export function getGentleReminderEmail(
  archiveName: string,
  continueLink: string
): string {
  return `
    <div style="background-color: #f4f1ea; padding: 50px; font-family: 'Georgia', serif; color: #5a6b78; line-height: 1.8;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #fdfbf7; padding: 60px; border: 1px solid #e8d8cc; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">

        <p style="font-size: 16px; margin-bottom: 25px;">
          Your archive of <strong style="color: #5a6b78;">${archiveName}</strong> is waiting for you.
        </p>

        <p style="font-size: 16px; margin-bottom: 25px; color: #888;">
          There is no urgency. Return when you are ready.
        </p>

        <div style="text-align: center; margin-top: 40px;">
          <a href="${continueLink}" style="background-color: #5a6b78; color: #fdf6f0; padding: 16px 30px; text-decoration: none; border-radius: 2px; font-size: 14px; letter-spacing: 0.05em; display: inline-block;">
            Continue the archive
          </a>
        </div>

        <div style="margin-top: 60px; padding-top: 30px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #bbb;">
          <p>ULUMAE. What deserves to be passed on must not be lost.</p>
        </div>
      </div>
    </div>
  `;
}

export function getSuccessorAlertEmail(
  successorName: string,
  ownerName: string,
  claimLink: string
): string {
  return `
    <div style="background-color: #fdf6f0; padding: 40px; font-family: sans-serif; color: #5a6b78;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border: 2px solid #d4958a;">
        <h2 style="font-family: serif; color: #d4958a; font-size: 24px; margin-bottom: 20px; text-transform: uppercase;">
          Urgent: Archive Status Alert
        </h2>
        <p>Dear ${successorName},</p>
        <p>
          You are the designated Archive Steward for <strong>${ownerName}</strong>.
        </p>
        <p>
          We have not received a response from ${ownerName} regarding their annual verification check for over 90 days. 
          Per their instructions, we are notifying you to investigate their status.
        </p>
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #d4958a; margin: 20px 0;">
          <strong>Next Steps:</strong><br/>
          If ${ownerName} has passed away or is incapacitated, please use the link below to begin the archive transfer process.
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${claimLink}" style="background-color: #5a6b78; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Options & Report Status
          </a>
        </div>
      </div>
    </div>
  `;
}

export function getDeadManSwitchTransferEmail(
  successorName: string,
  ownerName: string,
  dashboardLink: string
): string {
  return `
    <div style="background-color: #fdf6f0; padding: 40px; font-family: sans-serif; color: #5a6b78;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; border: 2px solid #89b896;">
        <h2 style="font-family: serif; color: #5a6b78; font-size: 24px; margin-bottom: 20px;">
          Stewardship transfer completed
        </h2>
        <p>Dear ${successorName},</p>
        <p>
          ${ownerName}'s Dead Man's Switch reached its deadline and stewardship has now been transferred to you.
        </p>
        <p>
          You now own the account's memorials. The previous owner remains a reader so every archive and its history stay preserved.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardLink}" style="background-color: #5a6b78; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Open your dashboard
          </a>
        </div>
      </div>
    </div>
  `;
}

export function getSealCompletedEmail({
  memorialName,
  transactionId,
  gatewayUrl,
  successUrl,
}: {
  memorialName: string;
  transactionId: string;
  gatewayUrl: string;
  successUrl: string;
}) {
  const safeMemorialName = escapeHtml(memorialName);
  const safeTransactionId = escapeHtml(transactionId);
  const safeGatewayUrl = escapeHtml(gatewayUrl);
  const safeSuccessUrl = escapeHtml(successUrl);

  return `
    <div style="margin:0; padding:48px 20px; background:#f4efe6; font-family: Georgia, serif; color:#4f4338;">
      <div style="max-width:640px; margin:0 auto; background:#fcfaf5; border:1px solid #ddd0bf; overflow:hidden; box-shadow:0 10px 30px rgba(79, 67, 56, 0.06);">
        <div style="padding:16px 28px; background:#f0e7da; border-bottom:1px solid #ddd0bf; text-align:center;">
          <p style="margin:0; font-size:11px; letter-spacing:0.28em; text-transform:uppercase; color:#8d7765;">ULUMAE</p>
        </div>

        <div style="padding:48px 36px 36px;">
          <p style="margin:0 0 14px; font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:#9a8572;">Seal complete</p>
          <h1 style="margin:0; font-size:38px; line-height:1.08; font-weight:400; color:#4f4338;">
            ${safeMemorialName}
            <span style="display:block; font-style:italic; color:#7b8a63;">has been sealed forever</span>
          </h1>

          <p style="margin:26px 0 0; font-size:17px; line-height:1.8; color:#5e5145;">
            The memorial has been permanently written to Arweave. Your PDF certificate is attached to this email.
          </p>

          <div style="margin:28px 0 0; padding:18px 20px; background:#f7f2ea; border:1px solid #e3d7c8;">
            <p style="margin:0; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#9a8572;">Transaction ID</p>
            <p style="margin:10px 0 0; font-size:14px; line-height:1.7; color:#4f4338; word-break:break-word;">${safeTransactionId}</p>
          </div>

          <p style="margin:22px 0 0; font-size:14px; line-height:1.8; color:#7a6a5c;">
            Keep the attached certificate and its password in a safe place. ULUMAE cannot recover that password if it is lost.
          </p>

          <div style="margin:34px 0 0; text-align:center;">
            <a href="${safeSuccessUrl}" style="display:inline-block; padding:16px 32px; background:#667552; color:#fcfaf5; text-decoration:none; border:1px solid #667552; font-size:13px; letter-spacing:0.16em; text-transform:uppercase;">
              View sealed memorial
            </a>
          </div>

          <p style="margin:28px 0 0; font-size:14px; line-height:1.8; color:#7a6a5c; text-align:center;">
            Arweave link:
          </p>
          <p style="margin:12px 0 0; font-size:13px; line-height:1.7; word-break:break-all; text-align:center;">
            <a href="${safeGatewayUrl}" style="color:#667552; text-decoration:underline;">${safeGatewayUrl}</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransporter({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send workspace invitation
exports.sendWorkspaceInvitation = async (email, workspaceName, inviterName, inviteCode) => {
  const invitationLink = `${process.env.FRONTEND_URL}/join/${inviteCode}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `You've been invited to join ${workspaceName} on Slack Clone`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join ${workspaceName}</h2>
        <p>${inviterName} has invited you to join the <strong>${workspaceName}</strong> workspace on Slack Clone.</p>
        <p>Click the link below to accept the invitation:</p>
        <a href="${invitationLink}" style="display: inline-block; padding: 12px 24px; background-color: #4A154B; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Join Workspace
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${invitationLink}</p>
        <hr>
        <p style="color: #666; font-size: 14px;">
          This invitation was sent from Slack Clone. If you weren't expecting this invitation, you can ignore this email.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Invitation email sent to:', email);
  } catch (error) {
    console.error('Error sending invitation email:', error);
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, resetToken) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Reset Your Slack Clone Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>You requested to reset your password for your Slack Clone account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4A154B; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p>${resetLink}</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <hr>
        <p style="color: #666; font-size: 14px;">
          If you didn't request a password reset, please ignore this email. Your account remains secure.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};
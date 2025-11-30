'use server'

export async function logUserLogin(userId: string, email: string, firstName?: string | null, lastName?: string | null) {
  console.log('----------------------------------------------------------------');
  console.log(`👤 USER LOGIN DETECTED`);
  console.log(`🆔 User ID:   ${userId}`);
  console.log(`📧 Email:     ${email}`);
  console.log(`Mw Name:      ${firstName || ''} ${lastName || ''}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------');
}

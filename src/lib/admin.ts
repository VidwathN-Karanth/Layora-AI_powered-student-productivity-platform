export const ADMIN_EMAILS = [
  'vidwathkaranth@gmail.com',
  'shreejith@mite.ac.in',
  '4mt24cs239@mite.ac.in'
];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

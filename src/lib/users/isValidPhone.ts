export function isValidPhone(phone: string): boolean {
  return /^\d{10,13}$/.test(phone);
}

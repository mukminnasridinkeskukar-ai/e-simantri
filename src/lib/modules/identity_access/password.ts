// ============================================================
// MODUL: identity_access — hashing & verifikasi kata sandi
// bcrypt (bcryptjs). Biaya hashing 12. Sandi tidak pernah disimpan
// atau dicatat dalam log dalam bentuk apa pun.
// ============================================================

import bcrypt from 'bcryptjs'

const COST = 12

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, COST)
}

export function verifyPassword(plain: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(plain, hash)
  } catch {
    return false
  }
}

export function validatePasswordStrength(plain: string): string | null {
  if (plain.length < 8) return 'Kata sandi minimal 8 karakter.'
  if (!/[a-zA-Z]/.test(plain)) return 'Kata sandi harus memuat huruf.'
  if (!/[0-9]/.test(plain)) return 'Kata sandi harus memuat angka.'
  return null
}

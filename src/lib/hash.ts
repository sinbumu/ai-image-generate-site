import crypto from 'crypto'

const SALT = process.env.KEY_HASH_SALT || 'dev_salt_change_me'

export function hashUserKey(userKey: string): string {
  return crypto.createHash('sha256').update(SALT + userKey).digest('hex')
}



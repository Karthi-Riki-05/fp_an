import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);

/**
 * Password hashing service.
 *
 * - New hashes use bcryptjs (12 rounds).
 * - Verifies bcryptjs hashes natively.
 * - Verifies the seed's `scrypt$<salt>$<hex>` format (used in Phase 2 seed
 *   when bcryptjs wasn't yet in the deps); on successful login the auth
 *   layer should re-hash these to bcrypt.
 * - Verifies legacy Laravel bcrypt hashes ($2y$...) — bcryptjs accepts $2y$
 *   variants identical to $2a$/$2b$.
 */
@Injectable()
export class PasswordService {
  private readonly bcryptRounds = 12;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.bcryptRounds);
  }

  async verify(plain: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
    if (!stored) return { ok: false, needsRehash: false };

    if (stored.startsWith('scrypt$')) {
      const ok = await this.verifyScrypt(plain, stored);
      return { ok, needsRehash: ok }; // always rehash scrypt seeds to bcrypt
    }

    // bcryptjs accepts $2a$, $2b$, $2y$ variants.
    if (stored.startsWith('$2')) {
      const ok = await bcrypt.compare(plain, stored);
      return { ok, needsRehash: false };
    }

    return { ok: false, needsRehash: false };
  }

  private async verifyScrypt(plain: string, stored: string): Promise<boolean> {
    const [, salt, hex] = stored.split('$');
    if (!salt || !hex) return false;
    const derived = (await scrypt(plain, salt, 64)) as Buffer;
    return derived.toString('hex') === hex;
  }
}

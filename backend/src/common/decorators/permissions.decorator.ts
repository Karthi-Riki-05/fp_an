import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

// Stub. Usage: @Permissions('manage-equipment')
// Permission inventory in MIGRATION_NOTES.md §4.5.
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

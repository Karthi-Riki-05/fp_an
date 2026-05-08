// Soft-delete helpers (per MIGRATION_NOTES.md §4.4 / R2 v3 decision).
// No global Prisma middleware — services compose these explicitly.

export const notDeleted = () => ({ deletedAt: null });

export const includingDeleted = () => ({});

// Convenience: turns a flag into the right partial where clause.
export const softDeleteFilter = (includeDeleted = false) =>
  includeDeleted ? includingDeleted() : notDeleted();

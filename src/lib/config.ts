// This file contains global configuration constants for the application.

// DEPRECATED: The hardcoded admin UID is no longer the primary source of truth for admin access.
// It is now used only as a "super admin" fallback to grant the first admin claim.
// The system now relies on Firebase Custom Claims (`admin: true`).
export const ADMIN_UID = 'BpA8qniZ03YttlnTR25nc6RrWrZ2';

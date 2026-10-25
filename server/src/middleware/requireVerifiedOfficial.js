// Barangay officials must confirm their email before they can use any data route.
// Residents are not affected here (their own flow handles verification).
export function isBlockedUnverifiedOfficial({ role, profileVerified, tokenVerified }) {
  if (!role || role === 'resident') return false;
  return !(profileVerified === true || tokenVerified === true);
}

export function requireVerifiedOfficial(req, res, next) {
  const blocked = isBlockedUnverifiedOfficial({
    role: req.userRole,
    profileVerified: req.userProfile?.emailVerified,
    tokenVerified: req.firebaseUser?.email_verified,
  });

  if (blocked) {
    return res.status(403).json({
      error: 'Verify your email to access this account.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  next();
}
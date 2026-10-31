export function requireActiveUser({ allowUnregistered = false } = {}) {
  return (req, res, next) => {
    if (!req.userProfile) {
      if (allowUnregistered) return next();
      return res.status(403).json({
        error: 'Complete registration before accessing this feature',
        code: 'PROFILE_REQUIRED',
      });
    }

    if (req.userProfile.status !== 'active') {
      return res.status(403).json({
        error: 'Account suspended — access to this feature is blocked',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    next();
  };
}

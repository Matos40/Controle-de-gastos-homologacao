export function googleProfileFromToken(claims, existing) {
  const {email, auth_time: login, picture} = claims;
  if (claims.firebase?.sign_in_provider !== 'google.com' || claims.email_verified !== true ||
      typeof email !== 'string' || !email || email.length > 320 ||
      !Number.isSafeInteger(login) || login <= (existing?.lastLoginSeconds ?? 0)) return null;
  const name = typeof claims.name === 'string' && claims.name.length <= 160 ? claims.name : '';
  const photo = typeof picture === 'string' && picture.length <= 2048 &&
    /^https:\/\/lh3\.googleusercontent\.com\/[^\s]*$/.test(picture) ? picture : '';
  const next = {email, name, photo, lastLoginSeconds: login};
  if (existing?.createdAtMs != null) next.createdAtMs = existing.createdAtMs;
  return next;
}

export function adminIdentity(profile) {
  const google = profile.googleProfile;
  if (!google) return profile;
  return {...profile, name: google.name || profile.name, email: google.email, photo: google.photo,
    createdAt: google.createdAtMs ? new Date(google.createdAtMs) : profile.createdAt,
    lastAccess: new Date(google.lastLoginSeconds * 1000)};
}

export function googleProfileFromAdmin(record, existing) {
  const google = record.providerUserInfo?.find(provider => provider.providerId === 'google.com');
  const createdAtMs = Number(record.createdAt);
  const lastLoginSeconds = Math.floor(Number(record.lastLoginAt) / 1000);
  if (!google || !Number.isSafeInteger(createdAtMs) || createdAtMs <= 0 || record.disabled) return null;
  const snapshot = googleProfileFromToken({
    firebase: {sign_in_provider: 'google.com'}, email_verified: record.emailVerified,
    email: record.email, name: google.displayName || record.displayName,
    picture: google.photoUrl || record.photoUrl, auth_time: lastLoginSeconds,
  });
  if (!snapshot) return null;
  // Keep the newer signed login if another session wrote while Auth was being queried.
  const next = {...(existing?.lastLoginSeconds > lastLoginSeconds ? existing : snapshot), createdAtMs};
  return Object.keys(next).every(key => next[key] === existing?.[key]) ? null : next;
}

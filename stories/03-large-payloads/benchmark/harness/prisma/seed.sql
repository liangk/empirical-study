-- Deterministic users rows for the benchmark. Shapes follow what cal.com
-- stores for an ordinary account: a username, a name, an email, an avatar URL,
-- a time zone, a short bio on some accounts, a small metadata object, a 2FA
-- secret on some. Nothing is padded to make the payload look worse.
--   psql -v n=10000 -f prisma/seed.sql
TRUNCATE "users";
INSERT INTO "users" (
  "id", "uuid", "username", "name", "email", "emailVerified", "bio", "avatarUrl",
  "timeZone", "weekStart", "bufferTime", "hideBranding", "theme", "appTheme", "created",
  "trialEndsAt", "lastActiveAt", "defaultScheduleId", "completedOnboarding", "locale",
  "timeFormat", "twoFactorSecret", "twoFactorEnabled", "backupCodes", "identityProvider",
  "identityProviderId", "invitedTo", "brandColor", "darkBrandColor", "allowDynamicBooking",
  "allowSEOIndexing", "receiveMonthlyDigestEmail", "requiresBookerEmailVerification",
  "metadata", "verified", "role", "organizationId", "locked", "movedToProfileId",
  "isPlatformManaged", "smsLockState", "smsLockReviewedByAdmin", "referralLinkId",
  "creationSource", "autoOptInFeatures"
)
SELECT
  i,
  md5('uuid' || i)::uuid,
  'user' || i,
  'User ' || i || ' ' || substr(md5('surname' || i), 1, 8),
  'user' || i || '@example.com',
  timestamp '2024-01-01' + (i % 600) * interval '1 day',
  CASE WHEN i % 5 < 2 THEN 'Product designer and calendar enthusiast. Book a call to talk about onboarding, research or anything else ' || i ELSE NULL END,
  'https://app.cal.com/api/avatar/' || md5('avatar' || i) || '.png',
  (ARRAY['Europe/London','America/New_York','Asia/Taipei','Australia/Sydney','Europe/Berlin'])[1 + i % 5],
  'Sunday', 0, false, NULL, NULL,
  timestamp '2023-06-01' + (i % 700) * interval '1 day',
  NULL,
  timestamp '2026-08-01' + (i % 60) * interval '1 day',
  i,
  true, 'en', 12,
  CASE WHEN i % 10 < 3 THEN encode(sha256(('2fa' || i)::bytea), 'hex') || encode(sha256(('iv' || i)::bytea), 'hex') ELSE NULL END,
  i % 10 < 3,
  NULL,
  'CAL', NULL, NULL,
  '#292929', '#fafafa',
  true, true, true, false,
  jsonb_build_object(
    'defaultConferencingApp', jsonb_build_object('appSlug', 'daily-video', 'appLink', NULL),
    'stripeCustomerId', 'cus_' || substr(md5('stripe' || i), 1, 14),
    'sessionTimeout', 15
  ),
  true, 'USER', NULL, false, NULL, false, 'UNLOCKED', false, NULL, 'webapp', false
FROM generate_series(1, :n) AS s(i);
ANALYZE "users";

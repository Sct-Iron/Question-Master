import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import process from 'node:process';

initializeApp({ credential: applicationDefault() });

const auth = getAuth();
const db = getFirestore();
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const allApproved = args.includes('--all-approved');
const uidIndex = args.indexOf('--uid');
const targetUid = uidIndex >= 0 ? args[uidIndex + 1] : '';

if ((!targetUid && !allApproved) || (targetUid && allApproved)) {
  console.error('Usage: node scripts/migrate-admin-claims.js --uid <uid> [--apply]');
  console.error('   or: node scripts/migrate-admin-claims.js --all-approved [--apply]');
  process.exit(1);
}

if (!apply) {
  console.log('Dry run: no custom claims will be changed. Add --apply to update claims.');
}

async function getCandidates() {
  if (targetUid) {
    const profile = await db.doc('users/' + targetUid).get();
    return profile.exists ? [{ uid: targetUid, profile: profile.data() }] : [];
  }

  const profiles = await db.collection('users')
    .where('role', '==', 'admin')
    .where('status', '==', 'approved')
    .get();
  return profiles.docs.map((profile) => ({ uid: profile.id, profile: profile.data() }));
}

const candidates = await getCandidates();
if (candidates.length === 0) {
  console.log('No matching admin profile found.');
  process.exit(0);
}

for (const candidate of candidates) {
  const profile = candidate.profile || {};
  if (profile.role !== 'admin' || profile.status !== 'approved') {
    console.log(candidate.uid + ': skipped because the profile is not an approved admin.');
    continue;
  }

  const user = await auth.getUser(candidate.uid);
  const existingClaims = user.customClaims || {};
  const nextClaims = {
    ...existingClaims,
    role: 'admin',
    isSuperAdmin: existingClaims.isSuperAdmin === true,
  };

  console.log(candidate.uid + ': ' + (user.email || '(no email)') + ' -> role=admin');
  if (apply) {
    await auth.setCustomUserClaims(candidate.uid, nextClaims);
    console.log('  custom claims updated; the user must refresh their ID token.');
  }
}

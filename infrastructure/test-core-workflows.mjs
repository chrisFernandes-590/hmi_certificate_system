import fs from 'node:fs';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const PM2_LOG = process.env.PM2_LOG_PATH || '/root/.pm2/logs/hmi-api-out.log';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractTokenFromLog(email) {
  if (!fs.existsSync(PM2_LOG)) {
    throw new Error(`PM2 log not found at ${PM2_LOG}`);
  }
  const lines = fs.readFileSync(PM2_LOG, 'utf8').split('\n');
  const matchPattern = `Verification link for ${email}:`;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes(matchPattern)) {
      const match = lines[i].match(/token=([A-Za-z0-9_-]+)/);
      if (match) return match[1];
    }
  }
  throw new Error(`Verification token not found in log for ${email}`);
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'content-type': 'application/json',
    'x-auth-client': 'native',
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    ...options,
    headers,
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return { status: res.status, ok: res.ok, body: json };
  } else {
    const arrayBuffer = await res.arrayBuffer();
    return { status: res.status, ok: res.ok, buffer: Buffer.from(arrayBuffer), headers: res.headers };
  }
}

async function runWorkflowTest() {
  console.log(`=== Starting E2E Core Workflow Verification against ${API_BASE} ===\n`);

  const ts = Date.now();
  const aliceEmail = `alice-${ts}@example.com`;
  const bobEmail = `bob-${ts}@example.com`;
  const password = 'Password123!';

  // Step 1: Register Alice (Organizer)
  console.log(`[1] Registering organizer: ${aliceEmail}`);
  const regAlice = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Alice Organizer', email: aliceEmail, password }),
  });
  if (!regAlice.ok) throw new Error(`Alice registration failed: ${JSON.stringify(regAlice.body)}`);
  console.log(`    Status: ${regAlice.status} - ${regAlice.body.data.message}`);

  // Step 2: Extract Alice token
  await sleep(1000);
  const aliceToken = extractTokenFromLog(aliceEmail);
  console.log(`    Found verification token: ${aliceToken.slice(0, 10)}...`);

  // Step 3: Verify Alice Email
  console.log(`[2] Verifying Alice's email...`);
  const verifyAlice = await api('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: aliceToken }),
  });
  if (!verifyAlice.ok) throw new Error(`Alice verification failed: ${JSON.stringify(verifyAlice.body)}`);
  console.log(`    Status: ${verifyAlice.status} - Email verified: ${verifyAlice.body.data.user.email}`);

  // Step 4: Login Alice
  console.log(`[3] Authenticating Alice (native Bearer auth)...`);
  const loginAlice = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: aliceEmail, password }),
  });
  if (!loginAlice.ok) throw new Error(`Alice login failed: ${JSON.stringify(loginAlice.body)}`);
  const aliceTokenHeader = `Bearer ${loginAlice.body.data.accessToken}`;
  console.log(`    Status: ${loginAlice.status} - AccessToken obtained`);

  // Step 5: Test /api/auth/me
  console.log(`[4] Testing protected /api/auth/me...`);
  const meAlice = await api('/api/auth/me', {
    headers: { authorization: aliceTokenHeader },
  });
  if (!meAlice.ok) throw new Error(`Alice /me failed: ${JSON.stringify(meAlice.body)}`);
  console.log(`    Status: ${meAlice.status} - User ID: ${meAlice.body.data.user.id}`);

  // Step 6: Create Organizer Profile for Alice
  console.log(`[5] Creating Organizer profile for Alice...`);
  const createOrg = await api('/api/profiles/organizer', {
    method: 'POST',
    headers: { authorization: aliceTokenHeader },
    body: JSON.stringify({
      displayName: 'Alice Events Org',
      roleLabel: 'teacher',
      institution: 'AWS Academy',
      termsAccepted: true,
    }),
  });
  if (!createOrg.ok) throw new Error(`Create organizer profile failed: ${JSON.stringify(createOrg.body)}`);
  console.log(`    Status: ${createOrg.status} - Organizer Profile ID: ${createOrg.body.data.profile.id}`);

  // Step 7: Switch Alice active profile to organizer
  console.log(`[6] Switching Alice active profile to 'organizer'...`);
  const switchOrg = await api('/api/profiles/active', {
    method: 'POST',
    headers: { authorization: aliceTokenHeader },
    body: JSON.stringify({ type: 'organizer' }),
  });
  if (!switchOrg.ok) throw new Error(`Switch profile failed: ${JSON.stringify(switchOrg.body)}`);
  console.log(`    Status: ${switchOrg.status} - Active profile type: ${switchOrg.body.data.profile.type}`);

  // Step 8: Create Event with startDate in future
  console.log(`[7] Creating Event as Organizer...`);
  const eventPayload = {
    name: 'AWS Cloud Architecture Summit 2026',
    description: 'Practical demonstration of cloud certificate system on EC2, RDS, and S3',
    startDate: new Date(Date.now() + 86400 * 1000).toISOString(),
    status: 'published',
  };
  const createEvt = await api('/api/events', {
    method: 'POST',
    headers: { authorization: aliceTokenHeader },
    body: JSON.stringify(eventPayload),
  });
  if (!createEvt.ok) throw new Error(`Create event failed: ${JSON.stringify(createEvt.body)}`);
  const eventId = createEvt.body.data.event.id;
  console.log(`    Status: ${createEvt.status} - Event Created! ID: ${eventId}, Name: "${createEvt.body.data.event.name}"`);

  // Step 9: Register Participant (Bob)
  console.log(`[8] Registering participant: ${bobEmail}`);
  const regBob = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bob Participant', email: bobEmail, password }),
  });
  if (!regBob.ok) throw new Error(`Bob registration failed: ${JSON.stringify(regBob.body)}`);
  await sleep(1000);
  const bobToken = extractTokenFromLog(bobEmail);
  console.log(`    Found verification token: ${bobToken.slice(0, 10)}...`);

  // Step 10: Verify Bob Email
  console.log(`[9] Verifying Bob's email...`);
  const verifyBob = await api('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: bobToken }),
  });
  if (!verifyBob.ok) throw new Error(`Bob verification failed: ${JSON.stringify(verifyBob.body)}`);

  // Step 11: Login Bob
  console.log(`[10] Authenticating Bob...`);
  const loginBob = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: bobEmail, password }),
  });
  if (!loginBob.ok) throw new Error(`Bob login failed: ${JSON.stringify(loginBob.body)}`);
  const bobTokenHeader = `Bearer ${loginBob.body.data.accessToken}`;

  // Step 12: Bob registers for the Event
  console.log(`[11] Bob registering for the event...`);
  const regEvent = await api(`/api/events/${eventId}/registration`, {
    method: 'POST',
    headers: { authorization: bobTokenHeader },
  });
  if (!regEvent.ok) throw new Error(`Event registration failed: ${JSON.stringify(regEvent.body)}`);
  console.log(`    Status: ${regEvent.status} - Registration successful! Status: ${regEvent.body.data.registrationStatus}`);

  // Step 13: Organizer lists event participants to find Bob's participantId
  console.log(`[12] Organizer fetching event participants...`);
  const listParticipants = await api(`/api/events/${eventId}/participants`, {
    headers: { authorization: aliceTokenHeader },
  });
  if (!listParticipants.ok) throw new Error(`List participants failed: ${JSON.stringify(listParticipants.body)}`);
  const participantRecord = listParticipants.body.data.participants.find((p) => p.email === bobEmail);
  if (!participantRecord) throw new Error(`Bob not found in participants list: ${JSON.stringify(listParticipants.body)}`);
  const participantId = participantRecord.participantId;
  console.log(`    Found Participant ID: ${participantId} for ${participantRecord.name}`);

  // Step 14: Organizer marks Bob as 'attended'
  console.log(`[13] Organizer marking Bob as 'attended'...`);
  const markAttended = await api(`/api/events/${eventId}/participants/${participantId}`, {
    method: 'PATCH',
    headers: { authorization: aliceTokenHeader },
    body: JSON.stringify({ status: 'attended' }),
  });
  if (!markAttended.ok) throw new Error(`Mark attended failed: ${JSON.stringify(markAttended.body)}`);
  console.log(`    Status: ${markAttended.status} - Participant status updated to: ${markAttended.body.data.registration.registrationStatus}`);

  // Step 15: Organizer issues certificate to Bob (PDF generation + S3 upload + RDS record)
  console.log(`[14] Organizer issuing certificate to Bob (renders PDF and uploads to S3)...`);
  const issueCert = await api(`/api/events/${eventId}/certificates`, {
    method: 'POST',
    headers: { authorization: aliceTokenHeader },
    body: JSON.stringify({
      participantId,
      title: 'Certificate of AWS Cloud Architecture Excellence',
      description: 'Awarded for verifying production-grade EC2, RDS TLS, and S3 architecture.',
    }),
  });
  if (!issueCert.ok) throw new Error(`Certificate issue failed: ${JSON.stringify(issueCert.body)}`);
  const cert = issueCert.body.data.certificate;
  console.log(`    Status: ${issueCert.status} - Certificate Issued!`);
  console.log(`    ID: ${cert.id}`);
  console.log(`    Certificate Number: ${cert.certificateNumber}`);
  console.log(`    Verification URL: ${cert.verificationUrl}`);

  // Extract verification token from verificationUrl
  const vTokenMatch = cert.verificationUrl.match(/\/verify\/([A-Za-z0-9_-]+)/);
  if (!vTokenMatch) throw new Error(`Could not parse verification token from ${cert.verificationUrl}`);
  const verificationToken = vTokenMatch[1];

  // Step 16: Download PDF as Bob
  console.log(`[15] Downloading certificate PDF from S3 as Bob...`);
  const downloadPdf = await api(`/api/certificates/${cert.id}/pdf`, {
    headers: { authorization: bobTokenHeader },
  });
  if (!downloadPdf.ok) throw new Error(`PDF download failed: status ${downloadPdf.status}`);
  const pdfHeader = downloadPdf.buffer.subarray(0, 5).toString('ascii');
  console.log(`    Status: ${downloadPdf.status} - Received ${downloadPdf.buffer.length} bytes`);
  console.log(`    Header Magic Bytes: "${pdfHeader}" (Valid PDF: ${pdfHeader === '%PDF-'})`);
  if (pdfHeader !== '%PDF-') throw new Error(`Downloaded file is not a valid PDF!`);

  // Step 17: Public QR Verification without authentication
  console.log(`[16] Testing public certificate verification (unauthenticated)...`);
  const verifyPublic = await api(`/api/verify/${verificationToken}`);
  if (!verifyPublic.ok) throw new Error(`Public verification request failed: ${JSON.stringify(verifyPublic.body)}`);
  console.log(`    Status: ${verifyPublic.status} - Result: ${verifyPublic.body.data.result}`);
  console.log(`    Valid: ${verifyPublic.body.data.valid}`);
  console.log(`    Event Name: "${verifyPublic.body.data.certificate.eventName}"`);
  console.log(`    Recipient: "${verifyPublic.body.data.certificate.participantName}"`);
  if (!verifyPublic.body.data.valid) throw new Error(`Public verification reported invalid certificate!`);

  // Step 18: Organizer revokes certificate
  console.log(`[17] Organizer revoking certificate...`);
  const revokeCert = await api(`/api/certificates/${cert.id}/revoke`, {
    method: 'PATCH',
    headers: { authorization: aliceTokenHeader },
    body: JSON.stringify({
      reason: 'Automated AWS architectural verification test lifecycle completion.',
    }),
  });
  if (!revokeCert.ok) throw new Error(`Certificate revocation failed: ${JSON.stringify(revokeCert.body)}`);
  console.log(`    Status: ${revokeCert.status} - Certificate revoked!`);
  console.log(`    Revoked Reason: "${revokeCert.body.data.certificate.revokedReason}"`);

  // Step 19: Public QR Verification after revocation (unauthenticated)
  console.log(`[18] Testing public certificate verification after revocation (unauthenticated)...`);
  const verifyRevoked = await api(`/api/verify/${verificationToken}`);
  if (!verifyRevoked.ok) throw new Error(`Public verification request failed: ${JSON.stringify(verifyRevoked.body)}`);
  console.log(`    Status: ${verifyRevoked.status} - Result: ${verifyRevoked.body.data.result}`);
  console.log(`    Valid: ${verifyRevoked.body.data.valid}`);
  console.log(`    Certificate Number: "${verifyRevoked.body.data.certificate.certificateNumber}"`);
  if (verifyRevoked.body.data.result !== 'revoked' || verifyRevoked.body.data.valid !== false) {
    throw new Error(`Public verification did not correctly reflect revoked state!`);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 ALL CORE WORKFLOW TESTS PASSED SUCCESSFULLY!`);
  console.log(`======================================================\n`);
}

runWorkflowTest().catch((err) => {
  console.error('\n❌ E2E Workflow Test Failed:', err);
  process.exit(1);
});

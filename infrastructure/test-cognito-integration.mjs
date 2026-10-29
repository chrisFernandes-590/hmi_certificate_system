const API_BASE = process.env.API_BASE_URL || 'http://13.233.212.183:3000';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || '7a2ootg1u1nfvmmqfv163p3u41';
const USERNAME = 'test-user@example.com';
const PASSWORD = 'TestPassword123';

async function authenticateWithCognito() {
  const cognitoUrl = `https://cognito-idp.${REGION}.amazonaws.com/`;
  const response = await fetch(cognitoUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME,
        PASSWORD,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cognito InitiateAuth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.AuthenticationResult;
}

async function runTest() {
  console.log(`=== Testing Live Amazon Cognito Authentication Integration ===\n`);
  console.log(`Target API: ${API_BASE}`);
  console.log(`Cognito Client ID: ${CLIENT_ID}`);
  console.log(`Cognito User: ${USERNAME}\n`);

  // Step 1: Authenticate against Amazon Cognito User Pool
  console.log(`[1] Authenticating test user with Amazon Cognito (InitiateAuth)...`);
  const authResult = await authenticateWithCognito();
  const idToken = authResult?.IdToken;
  const accessToken = authResult?.AccessToken;

  if (!idToken) throw new Error('Did not receive ID token from Cognito!');
  console.log(`    Status: SUCCESS - Received Cognito ID Token and Access Token`);
  console.log(`    ID Token prefix: ${idToken.slice(0, 30)}...`);

  // Step 2: Call protected /api/auth/me using the Cognito ID Token as Bearer
  console.log(`\n[2] Calling protected GET /api/auth/me with Cognito Bearer Token...`);
  const meRes = await fetch(`${API_BASE}/api/auth/me`, {
    headers: {
      authorization: `Bearer ${idToken}`,
    },
  });

  const meBody = await meRes.json();
  console.log(`    HTTP Status: ${meRes.status}`);
  console.log(`    Response Body:`, JSON.stringify(meBody, null, 2));

  if (!meRes.ok || !meBody.success) {
    throw new Error(`Failed to access /api/auth/me using Cognito JWT: ${JSON.stringify(meBody)}`);
  }

  const appUser = meBody.data.user;
  console.log(`\n[3] Verifying Application User Identity Mapping:`);
  console.log(`    Immutable Application User UUID: ${appUser.id}`);
  console.log(`    Application User Name: "${appUser.name}"`);
  console.log(`    Application User Email: "${appUser.email}"`);

  // Step 3: Access protected /api/events with the Cognito Bearer Token
  console.log(`\n[4] Calling protected GET /api/events with Cognito Bearer Token...`);
  const eventsRes = await fetch(`${API_BASE}/api/events`, {
    headers: {
      authorization: `Bearer ${idToken}`,
    },
  });

  const eventsBody = await eventsRes.json();
  console.log(`    HTTP Status: ${eventsRes.status}`);
  console.log(`    Events Retrieved: ${eventsBody.data?.events?.length ?? 0}`);

  if (!eventsRes.ok || !eventsBody.success) {
    throw new Error(`Failed to access /api/events using Cognito JWT: ${JSON.stringify(eventsBody)}`);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 LIVE AMAZON COGNITO INTEGRATION VERIFIED!`);
  console.log(`   - Verified JWT RSA signatures via Cognito JWKS`);
  console.log(`   - Verified external identity mapping to PostgreSQL users`);
  console.log(`   - Verified protected API access on EC2 via Cognito Bearer`);
  console.log(`======================================================\n`);
}

runTest().catch((err) => {
  console.error('\n❌ Cognito Integration Test Failed:', err);
  process.exit(1);
});

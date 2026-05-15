const fs = require('fs');
const path = require('path');

const SCRIPT_ID = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.clasp.json'), 'utf8')).scriptId;

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

async function main() {
  const accessToken = await getAccessTokenFromClasp();
  if (!accessToken) {
    throw new Error('Failed to obtain an Apps Script access token.');
  }

  const triggerRes = await fetch(`https://script.googleapis.com/v1/scripts/${SCRIPT_ID}:run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      function: 'applyEditSheetStopGrayRule',
      devMode: true,
    }),
  });

  const triggerJson = await triggerRes.json();
  if (!triggerRes.ok) {
    throw new Error(JSON.stringify(triggerJson));
  }

  const operationName = triggerJson.name || '';
  if (!operationName) {
    console.log(JSON.stringify(triggerJson));
    return;
  }

  const finalResult = await waitForOperation_(operationName, accessToken);
  if (finalResult.error) {
    throw new Error(JSON.stringify(finalResult.error));
  }

  console.log(JSON.stringify(finalResult.response || finalResult, null, 2));
}

async function waitForOperation_(operationName, accessToken) {
  const operationId = operationName.split('/').pop();
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`https://script.googleapis.com/v1/operations/${operationId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(JSON.stringify(json));
    }
    if (json.done) {
      return json;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Timed out waiting for Apps Script execution.');
}

async function getAccessTokenFromClasp() {
  const rcPath = path.join(process.env.USERPROFILE || '', '.clasprc.json');
  const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
  const token = rc.tokens && rc.tokens.default;
  if (!token || !token.client_id || !token.client_secret || !token.refresh_token) {
    return token && token.access_token ? token.access_token : '';
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: token.client_id,
      client_secret: token.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }
  return json.access_token || token.access_token || '';
}

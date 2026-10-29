import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function run() {
  const paramJson = execSync('aws ssm get-parameter --name /hmi-cert/api/database-url --with-decryption --region ap-south-1 --output json').toString();
  const rawUrl = JSON.parse(paramJson).Parameter.Value;
  const cleanUrl = rawUrl.split('?')[0];
  const rdsCa = fs.readFileSync('/etc/pki/tls/certs/global-bundle.pem', 'utf8');

  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: true, ca: rdsCa }
  });

  await client.connect();
  console.log('Connected to RDS PostgreSQL for migrations.');

  const migrationFiles = [
    '0000_curved_tyger_tiger.sql',
    '0001_magical_steve_rogers.sql',
    '0002_nasty_anthem.sql',
    '0003_certificate_event_recipient_unique.sql',
    '0004_participant_import_workflow.sql',
    '0005_user_profiles.sql',
    '0006_active_profile_session_repair.sql'
  ];

  for (const file of migrationFiles) {
    const filePath = path.join('/tmp/migrations', file);
    if (!fs.existsSync(filePath)) {
      throw new Error('Missing migration file: ' + file);
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log('Applying migration:', file);
    await client.query(sql);
    console.log('Applied:', file);
  }

  const tableRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Migration SUCCESS! Tables created (' + tableRes.rows.length + '): ' + tableRes.rows.map(r => r.table_name).join(', '));

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

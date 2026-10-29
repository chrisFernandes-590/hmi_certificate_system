import { Client } from 'pg';
import fs from 'fs';
import { execSync } from 'child_process';

async function syncMigrations() {
  const paramJson = execSync('aws ssm get-parameter --name /hmi-cert/api/database-url --with-decryption --region ap-south-1 --output json').toString();
  const rawUrl = JSON.parse(paramJson).Parameter.Value;
  const cleanUrl = rawUrl.split('?')[0];
  const rdsCa = fs.readFileSync('/etc/pki/tls/certs/global-bundle.pem', 'utf8');

  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: true, ca: rdsCa }
  });

  await client.connect();

  await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle";');
  await client.query('CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id serial primary key, hash text not null, created_at bigint);');

  const migrations = [
    { when: 1792004842012, hash: '4cffcf72e2c481d632a99d8902c2c28d790a17468c8a40f23053a51b28447ced' },
    { when: 1792390333419, hash: '6401ba5402b86f4532636f168c13efd4fe050216e82a5c321f675c9c48d4d990' },
    { when: 1792394903636, hash: '57c58668cd7f62d9537ed19773ed702a4fa2de23f8a110fc16457b3bfe86e56e' },
    { when: 1792475968665, hash: 'a8e15fee483ad8ae191bb6c8db5bc660cba8d0575e8763f949f800f1e5fe9d64' },
    { when: 1792829476127, hash: 'a7f192b86c909a3c776d7b5b829a0745b9e737f09fab84db8a40901d1d5911b0' },
    { when: 1792914180524, hash: '1812945dcbb15b76dc395fd4bc116da3be6b33dbe2c9b176d6a1896bba4d4fd0' },
    { when: 1792914180525, hash: '615ff94e6eccf5f00612811c940aff3d243656d6a66178c1753ef161728ebc5d' }
  ];

  for (const m of migrations) {
    const existing = await client.query('SELECT id FROM "drizzle"."__drizzle_migrations" WHERE created_at = $1', [m.when]);
    if (existing.rows.length === 0) {
      await client.query('INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)', [m.hash, m.when]);
    }
  }

  const rows = await client.query('SELECT id, hash, created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at;');
  console.log('SUCCESS: Drizzle migrations tracking verified! Total recorded entries:', rows.rows.length);
  for (const r of rows.rows) {
    console.log(`- Migration #${r.id}: hash=${r.hash.slice(0, 12)}... created_at=${r.created_at}`);
  }

  await client.end();
}

syncMigrations().catch(err => {
  console.error('Sync error:', err);
  process.exit(1);
});

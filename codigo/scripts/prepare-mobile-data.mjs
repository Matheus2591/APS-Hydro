import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { latestOfficialFile } from '../server/src/config.ts';
import { openDatabase } from '../server/src/db/database.ts';
import { importOfficial, getObservations } from '../server/src/import/official.ts';

// A mesma validação e os mesmos IDs do servidor geram a cópia real do APK.
const raw = JSON.parse(readFileSync(latestOfficialFile(), 'utf8').replace(/^\uFEFF/, ''));
const db = openDatabase(':memory:');
try {
  importOfficial(db, raw);
  const data = { metadata: raw.metadata, ...getObservations(db) };
  const target = fileURLToPath(
    new URL('../mobile/src/data/official-snapshot.json', import.meta.url),
  );
  writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
  console.log(
    `${data.items.length} medições reais incluídas no aplicativo. Fonte: ${raw.metadata.sourceUrl}`,
  );
} finally {
  db.close();
}

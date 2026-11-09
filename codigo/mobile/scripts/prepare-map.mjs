import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const directory = path.dirname(require.resolve('leaflet/package.json'));
const target = fileURLToPath(new URL('../src/map/', import.meta.url));
mkdirSync(target, { recursive: true });
// Biblioteca e estilos locais: o mapa não depende de um CDN para iniciar.
writeFileSync(
  path.join(target, 'leaflet-assets.json'),
  JSON.stringify({
    js: readFileSync(path.join(directory, 'dist/leaflet.js'), 'utf8'),
    css: readFileSync(path.join(directory, 'dist/leaflet.css'), 'utf8'),
  }),
);
copyFileSync(path.join(directory, 'LICENSE'), path.join(target, 'LEAFLET-LICENSE.txt'));
console.log('Leaflet 1.9.4 e sua licença preparados para Android e web.');

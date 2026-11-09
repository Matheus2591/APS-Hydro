import snapshot from './official-snapshot.json';
import type { OfficialObservation, SourceState } from '../types/domain';

// Cópia de dados reais, gerada pelo mesmo importador da API. Não são fixtures.
export const officialSnapshot: {
  metadata: { source: string; sourceUrl: string; accessedAt: string };
  items: OfficialObservation[];
  sources: SourceState[];
} = snapshot;

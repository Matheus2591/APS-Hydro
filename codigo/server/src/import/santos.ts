import { DEFAULT_SOURCE, importOfficial, recordSourceFailure } from './official.js';
import type { HydroDatabase } from '../db/database.js';

export const SANTOS_URL = 'https://www.santos.sp.gov.br/?q=pluviometria-tabela';
const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Lê somente as duas colunas da tabela oficial. Uma célula vazia não vira zero.
export function parseSantosPage(html: string, accessedAt = new Date().toISOString()) {
  const observations = [];
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      plainText(cell[1]),
    );
    const date = cells[0]?.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
    if (!date) continue;
    const year = date[3].length === 2 ? `20${date[3]}` : date[3];
    const observationDate = `${year}-${date[2]}-${date[1]}`;
    const timestamp = Date.parse(observationDate);
    if (
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== observationDate
    )
      throw new Error('A fonte publicou uma data inválida.');
    const raw = cells[1]?.trim();
    const value = raw === '' || raw === '-' ? null : Number(raw?.replace(',', '.'));
    if (
      value !== null &&
      (!raw || !/^\d+(?:[.,]\d+)?$/.test(raw) || !Number.isFinite(value) || value < 0)
    )
      throw new Error('A fonte publicou um índice inválido.');
    observations.push({
      observationDate,
      value,
      unit: 'mm' as const,
      period: 'daily' as const,
      scopeName: 'Santos',
      scopeType: 'municipality',
    });
  }
  observations.sort((a, b) => a.observationDate.localeCompare(b.observationDate));
  if (
    !observations.length ||
    observations.length > 31 ||
    new Set(observations.map((item) => item.observationDate)).size !== observations.length
  )
    throw new Error('Não foi possível reconhecer a tabela oficial de Santos.');
  const month = observations.at(-1)!.observationDate.slice(0, 7);
  if (observations.some((item) => !item.observationDate.startsWith(month)))
    throw new Error('A estrutura mensal da fonte mudou.');
  const published = plainText(html).match(/at[eé]\s+o\s+momento\s*([\d.,]+)\s*mm/i);
  const sum = observations.reduce((total, item) => total + (item.value ?? 0), 0);
  if (published && Math.abs(Number(published[1].replace(',', '.')) - sum) > 0.05)
    throw new Error('A soma da tabela não confere com o acumulado publicado.');
  return {
    metadata: {
      source: DEFAULT_SOURCE,
      sourceUrl: SANTOS_URL,
      accessedAt,
      datasetId: `santos-${month}`,
      accessMode: 'official_import',
      notes: [
        'Dados consultados diretamente na tabela HTTPS da Prefeitura de Santos.',
        'Histórico por data; sem horário ou coordenadas de estação publicados. Não representa monitoramento em tempo real.',
        'Unidade mm identificada no texto de acumulado abaixo da tabela; daily descreve a organização por data.',
      ],
    },
    observations,
  };
}

export async function refreshSantos(db: HydroDatabase, fetcher: typeof fetch = fetch) {
  try {
    const response = await fetcher(SANTOS_URL, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`A Prefeitura respondeu HTTP ${response.status}.`);
    const snapshot = parseSantosPage(await response.text());
    const result = importOfficial(db, snapshot);
    return { ...result, snapshot };
  } catch (error) {
    recordSourceFailure(
      db,
      DEFAULT_SOURCE,
      'Não foi possível atualizar a fonte oficial. O último conjunto real foi preservado.',
    );
    throw error;
  }
}

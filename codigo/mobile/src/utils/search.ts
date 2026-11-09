export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();

export const matchesSearch = (query: string, ...fields: string[]) =>
  normalizeSearch(fields.join(' ')).includes(normalizeSearch(query));

import { z } from 'zod';

export const reportSchema = z
  .object({
    id: z.uuid().transform((value) => value.toLowerCase()),
    installationId: z.uuid().transform((value) => value.toLowerCase()),
    category: z.enum(['water_accumulation', 'flooding', 'blocked_passage']),
    description: z
      .string()
      .trim()
      .min(1, 'Descreva a ocorrência.')
      .max(500, 'A descrição deve ter até 500 caracteres.'),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    locationMode: z.enum(['gps', 'map', 'reference']),
    accuracyMeters: z.number().finite().nonnegative().nullable(),
    observedAt: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString()),
    isDemo: z.boolean().default(true),
  })
  .strict();

const integerQuery = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .refine((value) => Number.isSafeInteger(value), 'Informe um inteiro seguro não negativo.');

export const cursorSchema = z
  .object({
    after: integerQuery.default(0),
    limit: integerQuery
      .refine((value) => value >= 1 && value <= 100, 'limit deve estar entre 1 e 100.')
      .default(100),
  })
  .strict();

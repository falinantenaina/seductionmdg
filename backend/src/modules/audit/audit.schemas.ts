import { z } from 'zod';
import { paginationSchema } from '../../utils/http.js';

export const listAuditQuerySchema = paginationSchema.extend({
  action: z.string().trim().max(60).optional(),
  entity: z.string().trim().max(60).optional(),
  userId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

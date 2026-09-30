import { z } from 'zod';

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(14),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

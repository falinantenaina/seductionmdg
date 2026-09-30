import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import type { CustomerBody, ListCustomersQuery } from './customer.schemas.js';

export async function listCustomers(query: ListCustomersQuery) {
  const where: Prisma.CustomerWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { contactName: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { orders: true, invoices: true } } },
  });
  if (!customer) throw notFound('Client');
  return customer;
}

export async function createCustomer(input: CustomerBody) {
  return prisma.customer.create({
    data: {
      name: input.name,
      contactName: input.contactName ?? null,
      email: input.email || null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      deliveryPlace: input.deliveryPlace ?? null,
      city: input.city ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive,
    },
  });
}

export async function updateCustomer(id: string, input: Partial<CustomerBody>) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw notFound('Client');

  return prisma.customer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.deliveryPlace !== undefined ? { deliveryPlace: input.deliveryPlace } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deactivateCustomer(id: string) {
  const existing = await prisma.customer.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
  if (!existing) throw notFound('Client');
  return prisma.customer.update({ where: { id }, data: { isActive: false } });
}

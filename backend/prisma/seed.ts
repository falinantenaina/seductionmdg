import bcrypt from 'bcryptjs';
import { PrismaClient, type Role, type Unit } from '@prisma/client';

const prisma = new PrismaClient();

const PASSWORD = 'Demo1234!';

/** Jeu de démonstration Madagascar : prix en Ariary (Ar), contacts en +261. */
const users: Array<{ email: string; firstName: string; lastName: string; role: Role; phone?: string }> = [
  { email: 'admin@seduction.cd', firstName: 'Alice', lastName: 'Admin', role: 'ADMIN', phone: '+261 34 000 001' },
  { email: 'commercial@seduction.cd', firstName: 'Bruno', lastName: 'Ventes', role: 'COMMERCIAL', phone: '+261 34 000 002' },
  { email: 'facturier@seduction.cd', firstName: 'Carla', lastName: 'Factures', role: 'FACTURIER', phone: '+261 34 000 003' },
  { email: 'magasinier@seduction.cd', firstName: 'Daniel', lastName: 'Magasin', role: 'MAGASINIER', phone: '+261 34 000 004' },
  { email: 'dispatcher@seduction.cd', firstName: 'Emma', lastName: 'Dispatch', role: 'DISPATCHER', phone: '+261 34 000 005' },
  { email: 'livreur@seduction.cd', firstName: 'Farid', lastName: 'Livraison', role: 'LIVREUR', phone: '+261 34 000 006' },
];

const categories: Array<{ name: string; description: string }> = [
  { name: 'Vêtements', description: 'Robes, chemises, pantalons, costumes et prêt-à-porter' },
  { name: 'Sacs', description: 'Sacs à main, sacoches et bagages' },
  { name: 'Bracelets', description: 'Bracelets artisanaux et joaillerie fantaisie' },
  { name: 'Accessoires', description: 'Foulards, écharpes et accessoires assortis' },
];

interface ArticleSeed {
  sku: string;
  name: string;
  category: string;
  unit: Unit;
  /** Prix en ariary (Ar), sans décimale. */
  price: number;
  stock: number;
  alertThreshold: number;
  description?: string;
}

const articles: ArticleSeed[] = [
  { sku: 'ART-001', name: 'Robe de soirée satinée', category: 'Vêtements', unit: 'PIECE', price: 180_000, stock: 40, alertThreshold: 10, description: 'Tailles 36 à 46' },
  { sku: 'ART-002', name: 'Chemise homme en coton', category: 'Vêtements', unit: 'PIECE', price: 45_000, stock: 60, alertThreshold: 15, description: 'Blanc, bleu, rayé' },
  { sku: 'ART-003', name: 'T-shirt coton imprimé', category: 'Vêtements', unit: 'PIECE', price: 25_000, stock: 120, alertThreshold: 30 },
  { sku: 'ART-004', name: 'Pantalon jean homme', category: 'Vêtements', unit: 'PIECE', price: 70_000, stock: 6, alertThreshold: 8, description: "Seuil d'alerte atteint" },
  { sku: 'ART-005', name: 'Jupe longue plissée', category: 'Vêtements', unit: 'PIECE', price: 55_000, stock: 45, alertThreshold: 10 },
  { sku: 'ART-006', name: 'Costume deux pièces', category: 'Vêtements', unit: 'PIECE', price: 350_000, stock: 20, alertThreshold: 5 },
  { sku: 'ART-007', name: 'Sac à main en cuir', category: 'Sacs', unit: 'PIECE', price: 250_000, stock: 30, alertThreshold: 6 },
  { sku: 'ART-008', name: "Sacoche d'école", category: 'Sacs', unit: 'PIECE', price: 65_000, stock: 50, alertThreshold: 10 },
  { sku: 'ART-009', name: 'Sac de voyage 45 L', category: 'Sacs', unit: 'PIECE', price: 150_000, stock: 4, alertThreshold: 5, description: "Seuil d'alerte atteint" },
  { sku: 'ART-010', name: 'Bracelet de perles colorées', category: 'Bracelets', unit: 'PIECE', price: 15_000, stock: 200, alertThreshold: 40 },
  { sku: 'ART-011', name: 'Bracelet en argent gravé', category: 'Bracelets', unit: 'PIECE', price: 85_000, stock: 35, alertThreshold: 8 },
  { sku: 'ART-012', name: 'Foulard en soie', category: 'Accessoires', unit: 'PIECE', price: 40_000, stock: 70, alertThreshold: 15 },
];

interface CustomerSeed {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  deliveryPlace?: string;
  city?: string;
  notes?: string;
}

const customers: CustomerSeed[] = [
  {
    name: 'Hanitra Rasoanaivo',
    contactName: 'Hanitra Rasoanaivo',
    email: 'hanitra.rasoanaivo@exemple.mg',
    phone: '+261 34 11 222 33',
    address: 'Lot II M 12, rue Rainandriamampandry — Analakely',
    deliveryPlace: 'Analakely, face à la Grande Poste',
    city: 'Antananarivo',
  },
  {
    name: 'Tiana Rakotoarisoa',
    contactName: 'Tiana Rakotoarisoa',
    email: 'tiana.rakoto@exemple.mg',
    phone: '+261 32 45 678 90',
    address: 'Lot B 45, rue du Port — Tamatave',
    deliveryPlace: 'Toamasina, quartier Bloche',
    city: 'Toamasina',
    notes: 'Livraison le matin de préférence',
  },
  {
    name: 'Miora Andrianina',
    contactName: 'Miora Andrianina',
    phone: '+261 33 76 543 21',
    address: 'Lot III C 8, avenue de l’Indépendance',
    deliveryPlace: "Antsirabe, près de l'hôtel des Thermes",
    city: 'Antsirabe',
  },
  {
    name: 'Lova Harisoa',
    contactName: 'Lova Harisoa',
    email: 'lova.harisoa@exemple.mg',
    phone: '+261 34 90 123 45',
    address: 'Lot I A 23, boulevard du Quai',
    deliveryPlace: 'Mahajanga, rue du quai',
    city: 'Mahajanga',
  },
  {
    name: 'ETS Rakotomalala & Fils',
    contactName: 'Jean-Claude Rakotomalala',
    email: 'contact@rakotomalala.mg',
    phone: '+261 20 22 33 44',
    address: 'Lot IV F 7, zone industrielle — Antsirabe',
    deliveryPlace: 'Antsirabe, zone industrielle, porte 3',
    city: 'Antsirabe',
    notes: 'Client revendeur',
  },
];

const deliveryPeople: Array<{ name: string; phone: string; vehicle?: string; email?: string }> = [
  { name: 'Hery Livraison', phone: '+261 34 12 345 67', vehicle: 'Moto — 4521 TBA', email: 'livreur@seduction.cd' },
  { name: 'Nina Express', phone: '+261 32 98 765 43', vehicle: 'Tricycle cargo — 7789 TBC' },
];

async function main(): Promise<void> {
  console.log('Seed en cours...');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role, isActive: true },
      create: { ...user, passwordHash, phone: user.phone ?? null },
    });
  }

  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const slug = category.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existing = await prisma.category.findUnique({ where: { slug } });
    const record = existing
      ? await prisma.category.update({ where: { slug }, data: { description: category.description } })
      : await prisma.category.create({ data: { name: category.name, slug, description: category.description } });
    categoryIds.set(category.name, record.id);
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@seduction.cd' } });

  for (const article of articles) {
    const existing = await prisma.article.findUnique({ where: { sku: article.sku } });

    if (existing) {
      await prisma.article.update({
        where: { sku: article.sku },
        data: {
          name: article.name,
          price: article.price,
          alertThreshold: article.alertThreshold,
          categoryId: categoryIds.get(article.category) ?? null,
          description: article.description ?? null,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          sku: article.sku,
          name: article.name,
          description: article.description ?? null,
          categoryId: categoryIds.get(article.category) ?? null,
          unit: article.unit,
          price: article.price,
          alertThreshold: article.alertThreshold,
          stockPhysical: article.stock,
          stockReserved: 0,
        },
      });

      await tx.stockMovement.create({
        data: {
          type: 'ENTREE',
          articleId: created.id,
          quantity: article.stock,
          previousPhysical: 0,
          newPhysical: article.stock,
          previousReserved: 0,
          newReserved: 0,
          userId: admin.id,
          comment: 'Stock initial (seed)',
        },
      });
    });
  }

  // Clients de démonstration (Madagascar) — le commercial peut aussi en créer.
  let customerCount = 0;
  for (const customer of customers) {
    const data = {
      name: customer.name,
      contactName: customer.contactName ?? null,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      address: customer.address ?? null,
      deliveryPlace: customer.deliveryPlace ?? null,
      city: customer.city ?? null,
      notes: customer.notes ?? null,
      isActive: true,
    };
    const existing = await prisma.customer.findFirst({ where: { name: customer.name } });
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data });
    } else {
      await prisma.customer.create({ data });
    }
    customerCount += 1;
  }

  const count = await prisma.user.count();

  for (const person of deliveryPeople) {
    const account = person.email
      ? await prisma.user.findUnique({ where: { email: person.email } })
      : null;
    const data = {
      name: person.name,
      phone: person.phone,
      vehicle: person.vehicle ?? null,
      userId: account?.id ?? null,
      isActive: true,
    };

    const existing = await prisma.deliveryPerson.findFirst({ where: { name: person.name } });
    if (existing) {
      await prisma.deliveryPerson.update({ where: { id: existing.id }, data });
    } else {
      await prisma.deliveryPerson.create({ data });
    }
  }

  const deliveryCount = await prisma.deliveryPerson.count();
  console.log(
    `Seed terminé : ${count} utilisateurs, ${articles.length} articles, ${categories.length} catégories, ${customerCount} clients, ${deliveryCount} livreurs.`,
  );
  console.log(`Mot de passe commun : ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

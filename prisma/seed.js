// This script runs once, manually, to put starting data into your
// real database. It's not part of the running server — it's a
// one-time (or occasional) setup tool.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const products = [
  {
    name: 'Original Root',
    tagline: 'Where it all started',
    description: 'Our founding batch. Fresh ginger, wild culture, and nothing else.',
    price: 6.50,
    currency: 'USD',
    size: '330ml',
    badge: 'Bestseller',
    heatLevel: 2,
    available: true,
    batch: '001'
  },
  {
    name: 'Turmeric Bug',
    tagline: 'Gold-flecked and grounded',
    description: 'Fresh turmeric root fermented alongside our ginger culture.',
    price: 7.00,
    currency: 'USD',
    size: '330ml',
    badge: 'New',
    heatLevel: 1,
    available: true,
    batch: '002'
  },
  {
    name: 'Habanero Reserve',
    tagline: 'Not for the faint-hearted',
    description: 'A small, limited reserve batch fermented with real habanero.',
    price: 8.50,
    currency: 'USD',
    size: '330ml',
    badge: 'Limited',
    heatLevel: 5,
    available: true,
    batch: '003'
  },
  {
    name: 'Lemon & Bug',
    tagline: 'Bright, sharp, easy',
    description: 'Cold-pressed lemon added at the end of the ferment.',
    price: 6.50,
    currency: 'USD',
    size: '330ml',
    badge: null,
    heatLevel: 2,
    available: true,
    batch: '004'
  }
]

async function main() {
  for (const product of products) {
    await prisma.product.create({ data: product })
  }

  await prisma.siteConfig.create({
    data: {
      heroTitle: 'Wild culture. Real ginger. No shortcuts.',
      heroSubtitle: "Every bottle is fermented in small batches with a live ginger culture we've kept going for years.",
      storyTitle: "What 'wild-fermented' actually means",
      storyText: 'Most ginger drinks are carbonated and flavored after the fact. Ours ferments naturally with a living culture.'
    }
  })

  console.log('Seed complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
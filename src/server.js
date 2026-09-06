import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { batch: 'asc' }
    })
    res.json(products)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
})

app.get('/api/config', async (req, res) => {
  try {
    const config = await prisma.siteConfig.findFirst()
    res.json(config)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch config' })
  }
})

app.listen(PORT, () => {
  console.log(`GingerBug backend running on http://localhost:${PORT}`)
})
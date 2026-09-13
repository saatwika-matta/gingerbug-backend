import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

dotenv.config()

const app = express()
const prisma = new PrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const PORT = process.env.PORT || 3001

app.use(cors())

// IMPORTANT: the webhook route must come BEFORE app.use(express.json()),
// and uses express.raw() instead — Stripe's signature check needs the
// raw, unparsed request body, not JSON already converted to an object.
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    await prisma.order.create({
      data: {
        stripeSessionId: session.id,
        customerEmail: session.customer_email,
        items: JSON.parse(session.metadata.items),
        totalAmount: session.amount_total / 100,
        status: 'paid',
        shippingAddress: session.collected_information?.shipping_details || null
      }
    })
  }
  res.json({ received: true })
})

// Everything below here gets JSON body parsing.
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
}
app.use(express.json())

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body

  const isValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.json({ token })
})

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
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(orders)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch orders' })
  }
})

app.post('/api/admin/products', requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.create({ data: req.body })
    res.json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create product' })
  }
})

app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body
    })
    res.json(product)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update product' })
  }
})

app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete product' })
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

app.post('/api/checkout', async (req, res) => {
  try {
    const { items, email } = req.body

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: item.quantity
    }))

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cart`,
      customer_email: email,
      shipping_address_collection: {
        allowed_countries: ['US']
      },
      metadata: {
        items: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })))
      }
    })

    res.json({ url: session.url })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

app.listen(PORT, () => {
  console.log(`GingerBug backend running on http://localhost:${PORT}`)
})
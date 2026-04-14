/* Simple Express server to proxy Google Sheets profiles

Envir

onment:
- Place a Google service account JSON at server/credentials.json
- Set SHEET_ID in environment or .env to the target Google Sheet ID

Endpoints:
- GET /profiles -> list rows
- POST /profiles -> create new profile (body: { name, email, balance })
- PUT /profiles/:rowIndex -> update profile at row index (body: { name, email, balance })
*/

import dotenv from 'dotenv'
import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import path from 'path'

// Load .env from repo root if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
import { loadProfiles, appendProfile, updateProfile, loadProfilesRaw } from './googleSheets.js'
import { OAuth2Client } from 'google-auth-library'

const app = express()
app.use(cors())
app.use(bodyParser.json())

app.get('/profiles', async (req, res) => {
  try {
    const rows = await loadProfiles()
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: String(err) })
  }
})

// Verify a Google ID token server-side and return a normalized profile
app.post('/auth/google', async (req, res) => {
  try {
    const { id_token } = req.body
    if (!id_token) return res.status(400).json({ error: 'Missing id_token' })

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return res.status(500).json({ error: 'Server missing GOOGLE_CLIENT_ID' })

    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({ idToken: id_token, audience: clientId })
    const payload = ticket.getPayload()

    // return the fields we use on the client
    const profile = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
    }
    res.json({ profile })
  } catch (err) {
    console.error('server: auth verification failed', err)
    res.status(401).json({ error: 'Invalid token' })
  }
})

// Debug: return the raw data object returned by the Sheets API for the range
app.get('/profiles/raw', async (req, res) => {
  try {
    const raw = await loadProfilesRaw()
    res.json(raw)
  } catch (err) {
    console.error('server: error loading raw profiles', err)
    res.status(500).json({ error: String(err) })
  }
})

// Simple root handler to make the server easier to test from a browser.
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html')
  res.send('<h1>Casino Profiles API</h1><p>Use <a href="/profiles">/profiles</a> to list profiles.</p>')
})

app.post('/profiles', async (req, res) => {
  try {
    const { name, email, balance } = req.body
    const created = await appendProfile({ name, email, balance })
    res.json(created)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/profiles/:rowIndex', async (req, res) => {
  try {
    // Optional method override for environments that cannot send PUT.
    if (String(req.body?._method || '').toUpperCase() !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { rowIndex } = req.params
    const { name, email, balance } = req.body
    const updated = await updateProfile(Number(rowIndex), { name, email, balance })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: String(err) })
  }
})

app.put('/profiles/:rowIndex', async (req, res) => {
  try {
    const { rowIndex } = req.params
    const { name, email, balance } = req.body
    const updated = await updateProfile(Number(rowIndex), { name, email, balance })
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: String(err) })
  }
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`)
})

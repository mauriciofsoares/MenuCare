import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import { app } from './server.js'

describe('API integration', () => {
  before(async () => {
    await app.ready()
  })

  after(async () => {
    await app.close()
  })

  it('health endpoint should return service ok', async () => {
    const response = await request(app.server).get('/health')

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(response.body.service, 'menucare-api')
  })

  it('login should reject wrong password', async () => {
    const response = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'wrong-password',
    })

    assert.equal(response.status, 401)
    assert.equal(response.body.status, 'error')
  })

  it('login should return token with valid credentials', async () => {
    const response = await request(app.server).post('/auth/login').send({
      email: 'admin@menucare.local',
      password: 'Admin@123',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'ok')
    assert.equal(typeof response.body.token, 'string')
    assert.ok(response.body.token.length > 20)
    assert.equal(response.body.user?.email, 'admin@menucare.local')
  })

  it('protected endpoint should require authentication', async () => {
    const response = await request(app.server).get('/compliance/exports/audit')

    assert.equal(response.status, 401)
    assert.equal(response.body.status, 'error')
  })

  it('login should return 429 after too many failed attempts', async () => {
    const targetEmail = 'blocked@menucare.local'

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await request(app.server).post('/auth/login').send({
        email: targetEmail,
        password: 'wrong-password',
      })

      assert.equal(response.status, 401)
    }

    const thresholdResponse = await request(app.server).post('/auth/login').send({
      email: targetEmail,
      password: 'wrong-password',
    })

    assert.equal(thresholdResponse.status, 429)
    assert.equal(thresholdResponse.body.status, 'error')

    const blockedResponse = await request(app.server).post('/auth/login').send({
      email: targetEmail,
      password: 'wrong-password',
    })

    assert.equal(blockedResponse.status, 429)
    assert.equal(blockedResponse.body.status, 'error')
  })
})

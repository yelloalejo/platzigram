'use strict'

const test = require('ava')
const uuid = require('uuid-base62')
const Db = require('../../lib/db')
const r = require('rethinkdb')
const fixtures = require('./fixtures')
const utils = require('../../lib/utils')

test.beforeEach('setup database', async t => {
  const dbName = `marugram_${uuid.v4()}`
  const db = new Db({ db: dbName })
  await db.connect()
  t.context.db = db
  t.context.dbName = dbName
  t.true(db.connected, 'should be connect')
})

test.afterEach.always('cleanup database', async t => {
  let db = t.context.db
  let dbName = t.context.dbName

  await db.disconnect()
  t.false(db.connected, 'should be disconnect')

  let conn = await r.connect({})
  await r.dbDrop(dbName).run(conn)
})

test('save image', async t => {
  let db = t.context.db

  t.is(typeof db.saveImage, 'function', 'saveImage is a function')

  let image = fixtures.getImage()

  let created = await db.saveImage(image)
  t.is(created.description, image.description)
  t.is(created.url, image.url)
  t.is(created.likes, image.likes)
  t.is(created.liked, image.liked)
  t.deepEqual(created.tags, [ 'awesome', 'tags', 'platzi' ])
  t.is(created.user_id, image.user_id)
  t.is(typeof created.id, 'string')
  t.is(created.public_id, uuid.encode(created.id))
  t.truthy(created.createAt)
})

test('like image', async t => {
  let db = t.context.db

  t.is(typeof db.likeImage, 'function', 'like image is a function')
  let image = fixtures.getImage()
  let created = await db.saveImage(image)
  let result = await db.likeImage(created.public_id)

  t.true(result.liked)
  t.is(result.like, image.likes + 1)
})

test('get image', async t => {
  let db = t.context.db
  t.is(typeof db.getImage, 'function', 'get image is a function')

  let image = fixtures.getImage()
  let created = await db.saveImage(image)
  let result = await db.getImage(created.public_id)

  t.deepEqual(created, result)

  t.throws(db.getImage('foo'), /not found/)
})

test('list all images', async t => {
  let db = t.context.db
  let images = fixtures.getImages(3)
  let saveImages = images.map(img => db.saveImage(img))
  let created = await Promise.all(saveImages)
  let result = await db.getImage()

  t.is(created.length, result.length)
})

test('save user', async t => {
  let db = t.context.db
  t.is(typeof db.saveUser, 'function', 'saveUser is a function')
  let user = fixtures.getUser()
  let plainPassword = user.password
  let created = await db.saveUser(user)
  t.is(user.username, created.username)
  t.is(user.email, created.email)
  t.is(user.name, created.name)
  t.is(utils.encrypt(plainPassword), created.password)
  t.is(typeof created.id, 'string')
  t.truthy(created.createdAt)
})

test('get user', async t => {
  let db = t.context.db
  t.is(typeof db.getUser, 'function', 'return an user')

  let user = fixtures.getUser()
  let created = await db.saveUser(user)
  let getUser = await db.getUser(created.username)
  t.throws(db.getUser, ('foo'))

  t.deepEqual(created.username, getUser.username)

  t.throws(db.getUser('foo'), /not found/)
})

test('authenticate user', async t => {
  let db = t.context.db
  t.is(typeof db.authenticate, 'function', 'authenticate is a function')
  let user = fixtures.getUser()
  let plainPassword = user.password
  await db.saveUser(user)

  let success = await db.authenticate(user.username, plainPassword)
  t.true(success)

  let fail = await db.authenticate(user.username, 'foo')
  t.false(fail)
  let failure = await db.authenticate('foo', 'bar')
  t.false(failure)
})

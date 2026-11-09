const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const User = require('../dist/models/user').default;
const mail = require('../dist/utils/brevo-mail');
const { UserController } = require('../dist/controllers/user.controller');
const response = () => ({ code: 200, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } });
const controller = new UserController();

test('forgot password rejects invalid identifiers', async () => {
  for (const identifier of [undefined, '', '  ', 123, { $ne: null }]) {
    const res = response();
    await controller.forgotPassword({ body: { identifier } }, res);
    assert.equal(res.code, 400);
  }
});
test('unknown account receives generic success without email', async t => {
  t.mock.method(User, 'findOne', async () => null);
  const send = t.mock.method(mail, 'sendBrevoEmail', async () => {});
  const res = response();
  await controller.forgotPassword({ body: { identifier: 'missing' } }, res);
  assert.equal(res.code, 200);
  assert.match(res.body.message, /^Ako postoji nalog/);
  assert.equal(send.mock.callCount(), 0);
});
test('forgot password saves a random five-minute token and emails its link', async t => {
  const user = { email: 'test@example.test', firstName: 'Test', save: async () => {} };
  t.mock.method(User, 'findOne', async query => { assert.deepEqual(query.$or, [{ username: 'test' }, { email: 'test' }]); return user; });
  const send = t.mock.method(mail, 'sendBrevoEmail', async (email, name, subject, text) => {
    assert.equal(email, user.email); assert.equal(subject, 'Promena lozinke');
    assert.ok(text.includes('http://localhost:4200/reset-password?token=' + user.resetPasswordToken));
  });
  const before = Date.now();
  const res = response();
  await controller.forgotPassword({ body: { identifier: ' test ' } }, res);
  assert.equal(res.code, 200); assert.equal(send.mock.callCount(), 1);
  assert.match(user.resetPasswordToken, /^[a-f0-9]{64}$/);
  assert.ok(user.resetPasswordExpires.getTime() >= before + 300000);
  assert.ok(user.resetPasswordExpires.getTime() <= Date.now() + 300000);
  assert.equal(JSON.stringify(res.body).includes(user.resetPasswordToken), false);
});
test('email failure returns a safe Serbian error', async t => {
  t.mock.method(User, 'findOne', async () => ({ email: 'test@example.test', save: async () => {} }));
  t.mock.method(mail, 'sendBrevoEmail', async () => { throw new Error('private provider details'); });
  const res = response(); await controller.forgotPassword({ body: { identifier: 'test' } }, res);
  assert.equal(res.code, 500); assert.equal(res.body.message, 'Greška pri slanju email poruke.');
});
test('reset validates token and all password rules', async () => {
  for (const password of [null, '', 'Abcde1!', 'Abcdefghijk1!', '1Abcdef!', 'abcdef1!', 'Abcdefg!', 'Abcdef12']) {
    const res = response(); await controller.resetPassword({ body: { token: 'token', password } }, res); assert.equal(res.code, 400);
  }
  const res = response(); await controller.resetPassword({ body: { password: 'Valid12!' } }, res); assert.equal(res.code, 400);
});
test('unknown or expired token is rejected', async t => {
  t.mock.method(User, 'findOne', async query => { assert.ok(query.resetPasswordExpires.$gt instanceof Date); return null; });
  const res = response(); await controller.resetPassword({ body: { token: 'expired', password: 'Valid12!' } }, res);
  assert.equal(res.code, 400); assert.equal(res.body.message, 'Link nije ispravan ili je istekao.');
});
test('reset hashes password and clears token in a conditional single-use update', async t => {
  t.mock.method(User, 'findOne', async () => ({ _id: 'user-id' }));
  t.mock.method(User, 'updateOne', async (query, update) => {
    assert.equal(query.resetPasswordToken, 'token'); assert.ok(query.resetPasswordExpires.$gt instanceof Date);
    assert.equal(await bcrypt.compare('Čbcdef1!', update.$set.passwordHash), true);
    assert.deepEqual(update.$unset, { resetPasswordToken: '', resetPasswordExpires: '' });
    return { modifiedCount: 1 };
  });
  const res = response(); await controller.resetPassword({ body: { token: 'token', password: 'Čbcdef1!' } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.message, 'Lozinka je uspešno promenjena.');
});
test('token consumed or expired during hashing cannot reset password', async t => {
  t.mock.method(User, 'findOne', async () => ({ _id: 'user-id' }));
  t.mock.method(User, 'updateOne', async () => ({ modifiedCount: 0 }));
  const res = response(); await controller.resetPassword({ body: { token: 'token', password: 'Valid12!' } }, res);
  assert.equal(res.code, 400);
});
test('reset fields are excluded from normal user queries', () => {
  assert.equal(User.schema.path('resetPasswordToken').options.select, false);
  assert.equal(User.schema.path('resetPasswordExpires').options.select, false);
});

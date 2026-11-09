const test = require('node:test');
const assert = require('node:assert/strict');
const Product = require('../dist/models/product').default;
const User = require('../dist/models/user').default;
const Order = require('../dist/models/order').default;
const Comment = require('../dist/models/comment').default;
const Reaction = require('../dist/models/reaction').default;
const { ProductController } = require('../dist/controllers/product.controller');
const { CommentController } = require('../dist/controllers/comment.controller');
const { requiredQuantities } = require('../dist/controllers/procurement.controller');
function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
test('details query includes both product code and printer', async t => {
  const product = { code: 'SAME', printingHouseUsername: 'second' };
  t.mock.method(Product, 'find', filter => {
    assert.deepEqual(filter, { code: 'SAME', active: true, printingHouseUsername: 'second' });
    return { limit: async () => [product] };
  });
  const res = response();
  await new ProductController().getProductByCode({ params: { code: 'SAME' }, query: { printingHouseUsername: 'second' } }, res);
  assert.equal(res.body, product);
});
test('legacy detail URL rejects ambiguous product codes', async t => {
  t.mock.method(Product, 'find', () => ({ limit: async () => [{ code: 'SAME' }, { code: 'SAME' }] }));
  const res = response();
  await new ProductController().getProductByCode({ params: { code: 'SAME' }, query: {} }, res);
  assert.equal(res.code, 400);
});
test('search treats regex punctuation as literal text', async t => {
  t.mock.method(Product, 'find', filter => {
    assert.equal(filter.name.$regex, '\\[a\\.\\*\\]');
    return Promise.resolve([]);
  });
  const res = response();
  await new ProductController().searchProducts({ query: { name: '[a.*]' } }, res);
  assert.equal(res.code, 200);
});
test('reaction derives printer from received invoice', async t => {
  t.mock.method(User, 'findOne', async () => ({ username: 'client' }));
  t.mock.method(Order, 'findOne', async () => ({ printingHouseUsername: 'second' }));
  t.mock.method(Product, 'findOne', async filter => {
    assert.deepEqual(filter, { code: 'SAME', printingHouseUsername: 'second' });
    return { _id: 'correct-product' };
  });
  t.mock.method(Reaction, 'findOne', async () => null);
  t.mock.method(Reaction.prototype, 'save', async function () { return this; });
  t.mock.method(Product, 'findOneAndUpdate', async filter => {
    assert.deepEqual(filter, { _id: 'correct-product' });
    return { likes: 1, dislikes: 0 };
  });
  const res = response();
  await new ProductController().reactToProduct({ params: { code: 'SAME' }, body: { username: 'client', invoiceId: 'INV-1', reaction: 'like' } }, res);
  assert.deepEqual(res.body, { likes: 1, dislikes: 0 });
});
test('comment duplicate save sends exactly one response', async t => {
  t.mock.method(User, 'findOne', async () => ({}));
  t.mock.method(Order, 'findOne', async () => ({ printingHouseUsername: 'second' }));
  t.mock.method(Product, 'findOne', async filter => {
    assert.equal(filter.printingHouseUsername, 'second');
    return {};
  });
  t.mock.method(Comment, 'findOne', async () => null);
  t.mock.method(Comment.prototype, 'save', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  const res = response();
  let responses = 0;
  res.json = () => { responses++; return res; };
  await new CommentController().createComment({ body: { productCode: 'SAME', username: 'client', invoiceId: 'INV-1', text: 'Good' } }, res);
  assert.equal(res.code, 400);
  assert.equal(responses, 1);
});
test('procurement aggregates normalized names and rejects invalid quantities', () => {
  assert.equal(requiredQuantities([{ productName: ' Shirt ', quantity: 2 }, { productName: 'SHIRT', quantity: 3 }]).get('shirt'), 5);
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => requiredQuantities([{ productName: 'Shirt', quantity }]));
  }
});
test('user schema declares unique username and email indexes', () => {
  for (const field of ['username', 'email']) {
    assert.ok(User.schema.indexes().some(([keys, options]) => keys[field] === 1 && options.unique));
  }
});

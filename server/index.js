
const path = require('path')
const express = require('express')
const compression = require('compression')
const next = require('next')
const helmet = require('helmet')

const routes = require('../routes')

const port = parseInt(process.env.PORT, 10) || 3100
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })

const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const logger = require('morgan');
const bodyParser = require('body-parser');


// shopify imports
const ShopifyAPIClient = require('shopify-api-node');
const ShopifyExpress = require('@shopify/shopify-express');
const {MemoryStrategy} = require('@shopify/shopify-express/strategies');


const isDevelopment = NODE_ENV !== 'production';

const shopifyConfig = {
  host: SHOPIFY_APP_HOST,
  apiKey: SHOPIFY_APP_KEY,
  secret: SHOPIFY_APP_SECRET,
  scope: ['read_orders, write_orders, write_products'],
  shopStore: new MemoryStrategy(),
  afterAuth(request, response) {
    const { session: { accessToken, shop } } = request;

    registerWebhook(shop, accessToken, {
      topic: 'orders/create',
      address: `${SHOPIFY_APP_HOST}/order-create`,
      format: 'json'
    });

    return response.redirect('/');
  },
};

// shopify webhook
const registerWebhook = function(shopDomain, accessToken, webhook) {
  const shopify = new ShopifyAPIClient({ shopName: shopDomain, accessToken: accessToken });
  shopify.webhook.create(webhook).then(
    response => console.log(`webhook '${webhook.topic}' created`),
    err => console.log(`Error creating webhook '${webhook.topic}'. ${JSON.stringify(err.response.body)}`)
  );
}

const handler = routes.getRequestHandler(app)

app.prepare().then(() => {
  const server = express()
  server.use(bodyParser.json());
  server.use(logger('dev'));
  server.use(helmet())
  server.use(compression())
  server.use(
    session({
      secret: SHOPIFY_APP_SECRET,
      store: isDevelopment ? undefined : new RedisStore(),
      resave: true,
      saveUninitialized: false,
    })
  );

  const staticPath = path.join(__dirname, '../static')
  server.use('/static', express.static(staticPath, {
    maxAge: '30d',
    immutable: true
  }))
  // json example
  server.get('/test', (req, res) => {
    return res.json({
      a: 'eee'
    })
  })

  // json example
  server.get('/redirect', (req, res) => {
    return res.redirect('/')
  })

  server.get('*', (req, res) => {
    return handler(req, res)
  })

  startServer()

  function startServer () {
    server.listen(port, () => {
      console.log(`> Ready on http://localhost:${port}`)
    })
  }
})

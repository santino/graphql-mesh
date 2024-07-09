import path from 'path';
import { setTimeout } from 'timers/promises';
import { createClient } from 'graphql-sse';
import { createTenv } from '@e2e/tenv';
import { TOKEN } from './services/products/server';

const { fs, spawn, service, serve } = createTenv(__dirname);

async function startServicesAndCreateSupergraphFile() {
  const services = [await service('products'), await service('reviews')];

  const supergraphConfig = {
    federation_version: '2',
    subgraphs: {},
  };
  for (const service of services) {
    supergraphConfig.subgraphs[service.name] = {
      routing_url: `http://0.0.0.0:${service.port}/graphql`,
      schema: {
        file: path.join(__dirname, 'services', service.name, 'typeDefs.graphql'),
      },
    };
  }

  const supergraphConfigFile = await fs.tempfile('supergraph.json');
  await fs.write(supergraphConfigFile, JSON.stringify(supergraphConfig));

  const [proc, waitForExit] = await spawn(
    `yarn rover supergraph compose --config ${supergraphConfigFile} --elv2-license=accept`,
  );
  await waitForExit;

  const supergraphFile = await fs.tempfile('supergraph.graphql');
  await fs.write(supergraphFile, proc.getStd('out'));
  return supergraphFile;
}

it('should subscribe and resolve', async () => {
  const supergraphFile = await startServicesAndCreateSupergraphFile();
  const { port } = await serve({ supergraph: supergraphFile });

  const client = createClient({
    url: `http://0.0.0.0:${port}/graphql`,
    retryAttempts: 0,
    headers: {
      Authorization: TOKEN,
    },
  });
  const sub = client.iterate({
    query: /* GraphQL */ `
      subscription OnProductPriceChanged {
        productPriceChanged {
          # Defined in Products subgraph
          name
          price
          reviews {
            # Defined in Reviews subgraph
            score
          }
        }
      }
    `,
  });

  const msgs = [];
  for await (const msg of sub) {
    msgs.push(msg);
    if (msgs.length >= 3) {
      break;
    }
  }

  expect(msgs).toMatchInlineSnapshot(`
[
  {
    "data": {
      "productPriceChanged": {
        "name": "Table",
        "price": 1798,
        "reviews": [
          {
            "score": 10,
          },
          {
            "score": 10,
          },
        ],
      },
    },
  },
  {
    "data": {
      "productPriceChanged": {
        "name": "Couch",
        "price": 2598,
        "reviews": [
          {
            "score": 10,
          },
        ],
      },
    },
  },
  {
    "data": {
      "productPriceChanged": {
        "name": "Chair",
        "price": 108,
        "reviews": [
          {
            "score": 10,
          },
        ],
      },
    },
  },
]
`);
});

it('should recycle websocket connections', async () => {
  const supergraphFile = await startServicesAndCreateSupergraphFile();
  const { port } = await serve({ supergraph: supergraphFile });

  const client = createClient({
    url: `http://0.0.0.0:${port}/graphql`,
    retryAttempts: 0,
    headers: {
      Authorization: TOKEN,
    },
  });

  const query = /* GraphQL */ `
    subscription OnProductPriceChanged {
      productPriceChanged {
        price
      }
    }
  `;
  for (let i = 0; i < 5; i++) {
    // connect
    for await (const msg of client.iterate({ query })) {
      expect(msg.data).toBeDefined();
      break; // complete subscription on first received message
    }
    // disconnect

    await setTimeout(300); // wait a bit and subscribe again (lazyCloseTimeout is 3 seconds)
  }

  // the "products" service will crash if multiple websockets were connected breaking the loop above with an error
});
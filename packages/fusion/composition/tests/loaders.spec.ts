import { OperationTypeNode } from 'graphql';
import { createGatewayRuntime, useCustomFetch } from '@graphql-hive/gateway-runtime';
import type { Logger } from '@graphql-mesh/types';
import { loadJSONSchemaSubgraph } from '@omnigraph/json-schema';
import { composeSubgraphs } from '../src/compose';

describe('Loaders', () => {
  const logger: Logger = {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: () => logger,
  };
  it('works', async () => {
    const loadedSubgraph = loadJSONSchemaSubgraph('TEST', {
      endpoint: 'http://localhost/my-test-api',
      operations: [
        {
          type: OperationTypeNode.QUERY,
          field: 'test',
          path: '/test',
          responseSchema: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      ],
    })({
      fetch,
      cwd: process.cwd(),
      logger,
    });
    const { supergraphSdl } = composeSubgraphs([
      {
        name: loadedSubgraph.name,
        schema: await loadedSubgraph.schema$,
      },
    ]);
    const mockFetch = jest.fn(async (_url: string) =>
      Response.json({
        id: 1,
        name: 'Test',
      }),
    );
    const runtime = createGatewayRuntime({
      supergraph: supergraphSdl,
      plugins() {
        return [useCustomFetch(mockFetch)];
      },
      logging: !!process.env.DEBUG,
    });
    const res = await runtime.fetch('/graphql', {
      method: 'POST',
      body: JSON.stringify({
        query: `query { test { id name } }`,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    await expect(res.json()).resolves.toMatchObject({
      data: {
        test: {
          id: 1,
          name: 'Test',
        },
      },
    });

    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost/my-test-api/test');
  });
});

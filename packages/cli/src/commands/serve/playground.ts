import { Request, Response, RequestHandler } from 'express';
import { loadDocuments } from '@graphql-tools/load';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { renderGraphiQL } from 'graphql-helix';

export function playground(exampleQuery: string, graphqlPath: string): RequestHandler {
  return async (req: Request, res: Response, next) => {
    if (req.query.query) {
      next();
      return;
    }

    let defaultQuery: string;
    if (exampleQuery) {
      const documents = await loadDocuments(exampleQuery, {
        loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
        cwd: process.cwd(),
      });

      defaultQuery = documents.reduce((acc, doc) => (acc += doc.rawSDL! + '\n'), '');
    }
    res.send(
      `
        <script>
          for (const key in localStorage) {
            if (key.startsWith('graphiql')) {
              localStorage.removeItem(key);
            }
          }
        </script>
      ` +
        renderGraphiQL({
          defaultQuery,
          endpoint: graphqlPath,
        })
    );
  };
}

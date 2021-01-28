import { Request, Response, RequestHandler } from 'express';
import { renderGraphiQL } from 'graphql-helix';

export function playground({
  defaultQuery,
  graphqlPath,
}: {
  defaultQuery: string;
  graphqlPath: string;
}): RequestHandler {
  return async (req: Request, res: Response, next) => {
    if (req.query.query) {
      next();
      return;
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

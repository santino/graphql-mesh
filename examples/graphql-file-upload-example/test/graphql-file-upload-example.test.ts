import { join } from 'path';
import { findAndParseConfig } from '@graphql-mesh/cli';
import { getMesh } from '@graphql-mesh/runtime';
import { File } from '@whatwg-node/fetch';
import { startServer as startResizeImageServer } from '../resize-image/server';
import { startServer as startUploadFilesServer } from '../upload-files/server';

describe('Upload Example', () => {
  let stopUploadFilesServer;
  let stopResizeImageServer;
  let mesh;
  beforeAll(async () => {
    stopUploadFilesServer = await startUploadFilesServer();
    stopResizeImageServer = await startResizeImageServer();
    const config = await findAndParseConfig({
      dir: join(__dirname, '..'),
    });
    mesh = await getMesh(config);
  });
  afterAll(async () => {
    await stopUploadFilesServer();
    await stopResizeImageServer();
    await mesh.destroy();
  });
  it('should give correct response', async () => {
    const file = new File(['CONTENT'], 'test.txt');
    const result = await mesh.execute(
      /* GraphQL */ `
        mutation UploadFile($upload: File!) {
          uploadFile(upload: $upload) {
            filename
          }
        }
      `,
      {
        upload: file,
      },
    );
    expect(result?.data?.uploadFile?.filename).toBe('test.txt');
  });
});

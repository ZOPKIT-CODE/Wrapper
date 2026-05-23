import { Client, Connection } from '@temporalio/client';

let _client: Client | null = null;

export function isTemporalEnabled(): boolean {
  return process.env.TEMPORAL_ENABLED === 'true';
}

export const WRAPPER_TASK_QUEUE =
  process.env.TEMPORAL_TASK_QUEUE_WRAPPER ?? 'wrapper-tasks';

export async function getTemporalClient(): Promise<Client> {
  if (_client) return _client;

  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';
  const apiKey = process.env.TEMPORAL_API_KEY;

  let connection: Connection;

  if (apiKey) {
    connection = await Connection.connect({ address, tls: true, apiKey });
  } else if (process.env.TEMPORAL_TLS_CERT && process.env.TEMPORAL_TLS_KEY) {
    connection = await Connection.connect({
      address,
      tls: {
        clientCertPair: {
          crt: Buffer.from(process.env.TEMPORAL_TLS_CERT, 'base64'),
          key: Buffer.from(process.env.TEMPORAL_TLS_KEY, 'base64'),
        },
      },
    });
  } else {
    connection = await Connection.connect({ address });
  }

  _client = new Client({ connection, namespace });
  return _client;
}

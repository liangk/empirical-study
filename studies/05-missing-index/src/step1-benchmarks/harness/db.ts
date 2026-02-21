import { PrismaClient } from '@prisma/client';

let _client: PrismaClient | null = null;

export function getClient(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({ log: [] });
  }
  return _client;
}

export async function disconnect(): Promise<void> {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    super({ adapter: new PrismaMssql(connectionString, { schema: 'dbo' }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async recoverFromInvalidConnectionState(error: unknown): Promise<boolean> {
    if (!this.isInvalidConnectionState(error)) return false;
    await this.$disconnect().catch(() => undefined);
    await this.$connect();
    return true;
  }

  private isInvalidConnectionState(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: unknown; message?: unknown };
    return (
      candidate.code === 'EINVALIDSTATE' ||
      (typeof candidate.message === 'string' &&
        candidate.message.includes('Requests can only be made in the LoggedIn state'))
    );
  }
}

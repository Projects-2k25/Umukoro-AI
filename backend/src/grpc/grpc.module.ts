import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { ScreeningServiceClient } from './screening-service.client';

/**
 * Resolve proto file paths for both dev (src/) and prod (dist/)
 */
function resolveProtoPath(filename: string): string {
  const distPath = join(process.cwd(), 'dist', 'proto', filename);
  if (existsSync(distPath)) return distPath;

  const srcPath = join(process.cwd(), 'src', 'proto', filename);
  if (existsSync(srcPath)) return srcPath;

  return join(__dirname, '../proto', filename);
}

const grpcClientsModule = ClientsModule.registerAsync([
  {
    name: 'SCREENING_SERVICE',
    imports: [ConfigModule],
    useFactory: (configService: ConfigService) => ({
      transport: Transport.GRPC,
      options: {
        package: 'screening',
        protoPath: resolveProtoPath('screening_service.proto'),
        url: configService.get<string>('AI_SERVICE_GRPC_URL', 'localhost:50051'),
        timeout: 120000,
        maxReceiveMessageLength: 10 * 1024 * 1024,
        maxSendMessageLength: 10 * 1024 * 1024,
        loader: {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          arrays: true,
        },
        keepalive: {
          keepaliveTimeMs: 30000,
          keepaliveTimeoutMs: 5000,
          keepalivePermitWithoutCalls: 1,
        },
      },
    }),
    inject: [ConfigService],
  },
]);

@Module({
  imports: [grpcClientsModule],
  providers: [ScreeningServiceClient],
  exports: [grpcClientsModule, ScreeningServiceClient],
})
export class GrpcModule {}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

async function bootstrap() {
  const httpsOptions = {
    key: readFileSync('ssl/key.pem'),
    cert: readFileSync('ssl/cert.pem'),
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      enableDebugMessages: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: false,
  });

  await app.listen(3001);

  console.log(`Application is running on: port ${3001}`);
}
void bootstrap();

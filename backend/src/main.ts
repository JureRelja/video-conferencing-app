import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

async function bootstrap() {
  const httpsOptions = {
    key: readFileSync('/app/ssl/privkey1.pem'),
    cert: readFileSync('/app/ssl/fullchain1.pem'),
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

  await app.listen(process.env.PORT ?? 3001);

  console.log(`Application is running on: port ${process.env.PORT ?? 3001}`);
}
void bootstrap();

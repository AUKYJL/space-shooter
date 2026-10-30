import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./infra/config/env";

async function bootstrap() {
  const config = env(process.env);
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.enableCors(
    {
      origin: "*",
    },
    
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder().setTitle("Space Shooter API").setVersion("0.0.0").build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(config.BE_PORT);
}

void bootstrap();

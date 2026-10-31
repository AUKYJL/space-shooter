import { Module, ValidationPipe } from "@nestjs/common";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./infra/prisma/prisma.module";
import { LoadoutModule } from "./modules/loadout/loadout.module";
import { JwtModule } from "./infra/jwt/jwt.module";
import { JwtAuthGuard } from "./shared/guards/jwt-auth.guard";
import { UsersModule } from "./modules/users/users.module";
import { AuthModule } from "./modules/auth/auth.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ProgressionModule } from "./modules/progression/progression.module";
import { RunsModule } from "./modules/runs/runs.module";
import { StationsModule } from "./modules/stations/stations.module";

@Module({
  imports: [
    PrismaModule,
    JwtModule,
    AuthModule,
    UsersModule,
    InventoryModule,
    ProgressionModule,
    LoadoutModule,
    RunsModule,
    StationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes({ path: "refresh", method: RequestMethod.POST });
  }
}


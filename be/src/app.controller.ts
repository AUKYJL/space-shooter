import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { PublicRoute } from "./shared/guards/public-route.decorator";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("/health")
  @PublicRoute()
  health() {
    return this.appService.health();
  }
}

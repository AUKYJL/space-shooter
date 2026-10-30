import { Body, Controller, Post } from "@nestjs/common";
import { PublicRoute } from "../../common/guards/public-route.decorator";
import { AuthService } from "./auth.service";
import { LoginDevDto } from "./dto/login-dev.dto";

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("/auth/login-dev")
  @PublicRoute()
  async loginDev(@Body() body: LoginDevDto) {
    return await this.auth.loginDev(body.username);
  }
}


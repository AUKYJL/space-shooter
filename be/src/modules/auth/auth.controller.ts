import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { PublicRoute } from "../../common/guards/public-route.decorator";
import { AuthService } from "./auth.service";
import { CredentialsDto } from "./dto/credentials.dto";

const cookieName = "refreshToken";
const cookieOptions = (): CookieOptions => ({
  httpOnly: true, path: "/refresh", sameSite: "lax", secure: process.env.NODE_ENV === "production",
});

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("/auth/register")
  @PublicRoute()
  async register(@Body() body: CredentialsDto, @Res({ passthrough: true }) response: Response) {
    return this.setSession(response, await this.auth.register(body));
  }

  @Post("/auth/login")
  @HttpCode(200)
  @PublicRoute()
  async login(@Body() body: CredentialsDto, @Res({ passthrough: true }) response: Response) {
    return this.setSession(response, await this.auth.login(body));
  }

  @Post("/refresh")
  @HttpCode(200)
  @PublicRoute()
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const token: unknown = request.cookies?.[cookieName];
      return this.setSession(response, await this.auth.refresh(typeof token === "string" ? token : undefined));
    } catch (error) {
      if (error instanceof UnauthorizedException) response.clearCookie(cookieName, cookieOptions());
      throw error;
    }
  }

  private setSession(response: Response, session: Awaited<ReturnType<AuthService["login"]>>) {
    response.cookie(cookieName, session.refreshToken, { ...cookieOptions(), expires: session.expiresAt });
    return { accessToken: session.accessToken };
  }
}

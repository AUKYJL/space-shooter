import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "../../infra/jwt/jwt.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { IS_PUBLIC_ROUTE } from "./public-route.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const authHeader = (request.headers as any)?.authorization;
    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedException();
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException();
    }

    let payload: ReturnType<JwtService["verify"]>;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    request.user = { id: user.id };
    return true;
  }
}

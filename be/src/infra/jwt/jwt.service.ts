import { Injectable } from "@nestjs/common";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { env } from "../config/env";

export type JwtPayload = {
  sub: string;
};

@Injectable()
export class JwtService {
  private readonly jwt = new NestJwtService();

  signUserToken(userId: string): string {
    const { JWT_SECRET } = env(process.env);
    return this.jwt.sign({ sub: userId } satisfies JwtPayload, {
      secret: JWT_SECRET,
    });
  }

  verify(token: string): JwtPayload {
    const { JWT_SECRET } = env(process.env);
    return this.jwt.verify<JwtPayload>(token, { secret: JWT_SECRET });
  }
}


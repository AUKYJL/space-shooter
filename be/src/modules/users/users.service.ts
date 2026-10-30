import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<{ id: string; username: string; createdAt: Date; bestScore: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, createdAt: true, bestScore: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}


import { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as request from "supertest";

export async function registerTestUser(app: INestApplication): Promise<string> {
  const result = await request(app.getHttpServer()).post("/auth/register")
    .send({ username: `test-${randomUUID()}`, password: "x" }).expect(201);
  return result.body.accessToken;
}

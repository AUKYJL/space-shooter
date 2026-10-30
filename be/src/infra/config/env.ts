import type { Env } from "./env.schema";
import { envSchema } from "./env.schema";

export function env(processEnv: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(processEnv);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

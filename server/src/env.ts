import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  SHEET_ID: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  CACHE_TTL_MS: z.coerce.number().default(2 * 60 * 1000),
  ADMIN_USERNAMES: z.string().optional(),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid env:\n${issues.join("\n")}`);
  }
  return parsed.data;
}


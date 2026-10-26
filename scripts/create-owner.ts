/**
 * `npm run admin:create-owner -- --email you@example.org --name "Your Name" [--reset]`
 *
 * Creates the single OWNER (or, with --reset, gives the existing owner a new
 * password and authenticator). The password comes from OWNER_PASSWORD or a
 * hidden prompt (never a CLI argument) and is never printed. The TOTP secret
 * is printed once, by design: it is what the authenticator app needs.
 *
 * Imports only pure modules (section 6.1a), so it runs under plain tsx.
 * Not fenced by assert-local-db: creating the owner on Neon is a documented
 * one-time step run with explicit env vars.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import QRCode from "qrcode";
import { createPrismaClient } from "../src/lib/prisma-factory";
import { defaultSiteSettings } from "../src/config/site";
import { fieldErrorsOf } from "../src/lib/validation/errors";
import { createEditorSchema } from "../src/lib/validation/users";
import { readTotpKey } from "../src/server/auth/keys";
import { hashPassword } from "../src/server/auth/password";
import { seal } from "../src/server/auth/secret-box";
import { newTotpSecret, otpauthUri, verifyTotp } from "../src/server/auth/totp";

class CliError extends Error {}

type Args = { email?: string; name?: string; reset: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { reset: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--reset") args.reset = true;
    else if (arg === "--email") args.email = argv[(i += 1)];
    else if (arg === "--name") args.name = argv[(i += 1)];
    else if (arg?.startsWith("--email=")) args.email = arg.slice(8);
    else if (arg?.startsWith("--name=")) args.name = arg.slice(7);
    else throw new CliError(`Unknown argument: ${arg}`);
  }
  return args;
}

/** Reads one line; with `hidden`, typed characters are not echoed. */
function ask(question: string, hidden = false): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output,
    terminal: process.stdin.isTTY === true,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    muted = hidden;
  });
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.OWNER_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    throw new CliError(
      "Set OWNER_PASSWORD or run in an interactive terminal to type the password.",
    );
  }
  const first = await ask("New owner password (hidden): ", true);
  const second = await ask("Repeat the password (hidden): ", true);
  if (first !== second) throw new CliError("The passwords don't match.");
  return first;
}

const groupSecret = (secret: string) => secret.match(/.{1,4}/g)!.join(" ");

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: rely on the process environment.
  }
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new CliError("DATABASE_URL is not set.");
  let key: Buffer;
  try {
    key = readTotpKey();
  } catch {
    throw new CliError(
      "TOTP_ENCRYPTION_KEY must be set to base64 for 32 bytes (see .env.example).",
    );
  }
  if (!args.email || !args.name) {
    throw new CliError(
      'Usage: npm run admin:create-owner -- --email you@example.org --name "Your Name" [--reset]',
    );
  }

  const password = await readPassword();
  const parsed = createEditorSchema.safeParse({
    name: args.name,
    email: args.email,
    password,
    confirmPassword: password,
  });
  if (!parsed.success) {
    const errors = fieldErrorsOf(parsed.error);
    throw new CliError(
      Object.entries(errors)
        .map(([field, message]) => `${field}: ${message}`)
        .join("\n"),
    );
  }
  const { email, name } = parsed.data;
  const passwordHash = await hashPassword(password);
  const secret = newTotpSecret();

  const prisma = createPrismaClient(url);
  try {
    const owner = await prisma.$transaction(async (tx) => {
      // Serializes concurrent runs: the exactly-one-owner invariant lives here.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(42002)`;
      const existing = await tx.adminUser.findFirst({
        where: { role: "OWNER" },
      });

      if (!args.reset) {
        if (existing) {
          throw new CliError(
            `An owner already exists (${existing.email}). Use --reset to reset the owner's password and authenticator.`,
          );
        }
        const taken = await tx.adminUser.findUnique({ where: { email } });
        if (taken) {
          throw new CliError(
            `An admin with the email ${email} already exists.`,
          );
        }
        // Create first (the id is part of the AAD), then seal (review NIT 2).
        const created = await tx.adminUser.create({
          data: {
            email,
            name,
            passwordHash,
            role: "OWNER",
            totpSecretEnc: null,
            totpEnabled: false,
          },
        });
        await tx.adminUser.update({
          where: { id: created.id },
          data: {
            totpSecretEnc: seal(secret, `totp:${created.id}`, key),
            totpEnabled: true,
          },
        });
        await tx.auditLog.create({
          data: {
            actorEmail: "cli",
            action: "owner.create",
            entityType: "AdminUser",
            entityId: created.id,
          },
        });
        return created;
      }

      if (!existing) {
        throw new CliError("No owner exists yet. Run without --reset first.");
      }
      if (existing.email !== email) {
        throw new CliError(
          "--email must match the existing owner's email address.",
        );
      }
      const updated = await tx.adminUser.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          totpSecretEnc: seal(secret, `totp:${existing.id}`, key),
          totpEnabled: true,
          lastTotpStep: null,
          isActive: true,
          failedLoginCount: 0,
          lockedUntil: null,
          sessionVersion: { increment: 1 },
        },
      });
      await tx.loginChallenge.deleteMany({ where: { userId: existing.id } });
      await tx.auditLog.create({
        data: {
          actorEmail: "cli",
          action: "owner.reset",
          entityType: "AdminUser",
          entityId: existing.id,
        },
      });
      return updated;
    });

    const settings = await prisma.siteSettings.findUnique({
      where: { id: "singleton" },
      select: { ministryName: true },
    });
    const issuer = `${settings?.ministryName ?? defaultSiteSettings.ministryName} Admin`;
    const uri = otpauthUri({ secret, email: owner.email, issuer });

    console.log(
      args.reset
        ? `\nOwner ${owner.email} was reset: new password and new authenticator. Other sessions are signed out.`
        : `\nOwner ${owner.email} created.`,
    );
    console.log(
      "\nSet up your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, ...):",
    );
    console.log("  1. Scan this QR code, or");
    console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
    console.log(`  2. Enter this key manually: ${groupSecret(secret)}`);
    console.log(`\notpauth URI: ${uri}`);
    console.log(
      "\nKeep this key private. It is shown only now; run with --reset if you lose it.",
    );

    if (process.stdin.isTTY) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const code = (
          await ask("\nEnter the 6-digit code from the app: ")
        ).replace(/\s+/g, "");
        if ((await verifyTotp(secret, code, null)).valid) {
          console.log(
            "Authenticator confirmed. You can sign in at /admin/login.",
          );
          return;
        }
        console.log("That code didn't work. Check the time on your phone.");
      }
      console.warn(
        "Warning: the code could not be confirmed. The account was kept; rerun with --reset if the app is not set up.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof CliError
      ? error.message
      : `create-owner failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});

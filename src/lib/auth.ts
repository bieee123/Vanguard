import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, twoFactor, username } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";

export const auth = betterAuth({
  appName: "Vanguard",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // browsers may reach the app via localhost / 127.0.0.1 / LAN IP — trust all of them,
  // plus anything listed in BETTER_AUTH_TRUSTED_ORIGINS (comma-separated)
  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map((s) => s.trim()) ?? []),
  ].filter(Boolean),
  emailAndPassword: {
    enabled: true,
    // ponytail: framework defaults only; explicit rate limiting lands with hardening (Sprint 5)
  },
  plugins: [
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          await sendMail(
            user.email,
            "Your Vanguard verification code",
            `Your Vanguard login code is ${otp}. It expires in 5 minutes.`
          );
        },
      },
    }),
    // PRD v2: single Admin role — every authenticated user gets role=admin
    admin({ defaultRole: "admin", adminRoles: ["admin"] }),
    username(),
  ],
});

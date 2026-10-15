import { PrismaAdapter } from "@auth/prisma-adapter";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/features/auth/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Credentials exige sessão JWT (Auth.js não suporta sessão de banco com
  // Credentials provider).
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail ou usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        if (user.status !== "ACTIVE" || user.deletedAt) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
      }
      // Disparado por `useSession().update(...)` depois de updateOwnProfile —
      // sem isso, nome/e-mail novos só apareceriam depois de logout/login.
      if (trigger === "update" && session) {
        const patch = session as { name?: string; email?: string };
        if (patch.name) token.name = patch.name;
        if (patch.email) token.email = patch.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await logActivity({
        userId: user.id ?? null,
        action: "login",
        entityType: "User",
        entityId: user.id ?? null,
      });
    },
    async signOut(message) {
      const userId =
        "token" in message ? (message.token?.id as string | undefined) : undefined;
      await logActivity({
        userId: userId ?? null,
        action: "logout",
        entityType: "User",
        entityId: userId ?? null,
      });
    },
  },
});

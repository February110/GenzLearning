import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import axios from "axios";

const API_BASE = process.env.API_INTERNAL_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL; // ví dụ: http://localhost:5081/api

const authOptions: NextAuthOptions = {
  providers: [
    // GOOGLE 
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // FACEBOOK 
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "email,public_profile", 
        },
      },
      profile(profile) {
        console.log("📘 Facebook profile:", profile);
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email || `${profile.id}@facebook.com`, 
          image: profile.picture?.data?.url ?? null,
        };
      },
    }),
  ],

  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },

  callbacks: {
    async signIn({ user, account }) {
      try {
        if (!account?.provider) return false;

        // Nếu user không có email (Facebook đôi khi không trả)
        if (!user?.email) {
          console.warn("⚠️ Không nhận được email từ Facebook. Từ chối đăng nhập.");
          return false;
        }

        // Gọi API backend để sync
        const res = await axios.post(`${API_BASE}/auth/sync`, {
          email: user.email,
          fullName: user.name,
          avatar: user.image,
          provider: account.provider,
          providerId: account.providerAccountId,
        });

        console.log("🟢 Sync success:", res.data);

        (user as any).backendToken = res.data.accessToken;
        (user as any).systemRole = res.data.systemRole;
        (user as any).fullName = res.data.fullName;

        return true;
      } catch (err: any) {
        console.error("❌ Sync with backend failed:", err?.message || err);
        return false;
      }
    },

    async jwt({ token, user, account }) {
      const u = user as any;

      if (u?.backendToken) {
        token.accessToken = u.backendToken;
        token.fullName = u.fullName;
        token.systemRole = u.systemRole;
      }

      if (account?.access_token) {
        token.oauthAccessToken = account.access_token;
      }

      return token;
    },

    async session({ session, token }) {
      if (token?.accessToken) {
        (session as any).accessToken = token.accessToken;
        (session.user as any).fullName = token.fullName;
        (session.user as any).systemRole = token.systemRole;

        if (typeof window !== "undefined") {
          localStorage.setItem("token", token.accessToken as string);
          localStorage.setItem(
            "user",
            JSON.stringify({
              fullName: token.fullName,
              email: session.user?.email,
              avatar: session.user?.image,
              systemRole: token.systemRole,
            })
          );
        }
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Tôn trọng callbackUrl nội bộ, ví dụ: "/redirect" để quyết định theo vai trò
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

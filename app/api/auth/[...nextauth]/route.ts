import NextAuth, { type NextAuthOptions, type User } from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  // Configure one or more authentication providers
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    }),
    // ...add more providers here
  ],
  callbacks: {
    async signIn({ user }: { user: User }) {
      if (user.email) {
        const authorizedEmails = (process.env.AUTHORIZED_EMAILS || "").split(
          ",",
        );
        if (authorizedEmails.includes(user.email)) {
          return true;
        }
      }
      return false;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

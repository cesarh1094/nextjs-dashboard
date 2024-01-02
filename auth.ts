import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';
import { error } from 'console';

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql<User>`SELECT * FROM users WHERE email = ${email}`;

    return user.rows[0];
  } catch (e) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        // validate user's creedentials
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        // Check if credentials are valid
        if (!parsedCredentials.success) {
          return null;
        }

        const { email } = parsedCredentials.data;

        const user = await getUser(email);

        // Check if user exists
        if (!user) {
          return null;
        }

        const { password } = parsedCredentials.data;

        const passwordMatch = await bcrypt.compare(password, user.password);

        // Check if passwords matches against what's in the database
        if (!passwordMatch) {
          console.log('Invalid credntials');

          return null;
        }

        // Send back the user databse object on success
        return user;
      },
    }),
  ],
});

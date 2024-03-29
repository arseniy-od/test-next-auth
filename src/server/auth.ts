import {PrismaAdapter} from '@next-auth/prisma-adapter';
import {type GetServerSidePropsContext} from 'next';
import {
    getServerSession,
    type DefaultSession,
    type NextAuthOptions,
} from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import CredentialsProvider from 'next-auth/providers/credentials';
import {verify} from 'argon2';

import {env} from '~/env.mjs';
import {db} from '~/server/db';
import {loginSchema} from '~/common/validation/auth';

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module 'next-auth' {
    interface Session extends DefaultSession {
        user: DefaultSession['user'] & {
            id: string;
            // ...other properties
            // role: UserRole;
        };
    }

    // interface User {
    //   // ...other properties
    //   // role: UserRole;
    // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
    callbacks: {
        session: ({session, user}) => ({
            ...session,
            user: {
                ...session.user,
                id: user.id,
            },
        }),
    },
    adapter: PrismaAdapter(db),
    providers: [
        DiscordProvider({
            clientId: env.DISCORD_CLIENT_ID,
            clientSecret: env.DISCORD_CLIENT_SECRET,
        }),
        CredentialsProvider({
            // The name to display on the sign in form (e.g. 'Sign in with...')
            name: 'Sign in',
            // The credentials is used to generate a suitable form on the sign in page.
            // You can specify whatever fields you are expecting to be submitted.
            // e.g. domain, username, password, 2FA token, etc.
            // You can pass any HTML attribute to the <input> tag through the object.
            credentials: {
                username: {
                    label: 'Username',
                    type: 'text',
                    placeholder: 'Enter your username',
                },
                password: {label: 'Password', type: 'password'},
            },
            async authorize(credentials, req) {
                // You need to provide your own logic here that takes the credentials
                // submitted and returns either a object representing a user or value
                // that is false/null if the credentials are invalid.
                // e.g. return { id: 1, name: 'J Smith', email: 'jsmith@example.com' }
                // You can also use the `req` object to obtain additional parameters
                // (i.e., the request IP address)
                const creds = await loginSchema.parseAsync(credentials);
                const user = await db.user.findFirst({
                    where: {username: creds.username},
                });

                if (!user) {
                    return null;
                }

                const isValidPassword = await verify(
                    user.password ?? '',
                    creds.password,
                );

                if (!isValidPassword) {
                    return null;
                }
                return {
                    id: user.id,
                    username: user.username,
                };
            },
        }),
        /**
         * ...add more providers here.
         *
         * Most other providers require a bit more work than the Discord provider. For example, the
         * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
         * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
         *
         * @see https://next-auth.js.org/providers/github
         */
    ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
    req: GetServerSidePropsContext['req'];
    res: GetServerSidePropsContext['res'];
}) => {
    return getServerSession(ctx.req, ctx.res, authOptions);
};

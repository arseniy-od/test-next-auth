import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {hash} from 'argon2';

import {
    createTRPCRouter,
    protectedProcedure,
    publicProcedure,
} from '~/server/api/trpc';
import { loginSchema } from '~/common/validation/auth';

export const authRouter = createTRPCRouter({
    signup: publicProcedure
        .input(loginSchema)
        .mutation(async ({input, ctx}) => {
            const {username, password} = input;
            const exists = await ctx.db.user.findFirst({
                where: {username},
            });

            if (exists) {
                throw new TRPCError({
                    code: 'CONFLICT',
                    message: 'User already exists.',
                });
            }
            const hashedPassword = await hash(password);
            const result = await ctx.db.user.create({
                data: {username, password: hashedPassword},
            });
            if (result.username) {
                return {
                    status: 201,
                    message: 'Account created successfully',
                    result: result.username,
                };
            } else {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Error while creating user',
                });
            }
        }),
});

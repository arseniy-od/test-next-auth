import * as z from 'zod';

export const loginSchema = z.object({
    username: z.string().min(4).max(12),
    password: z.string().min(4).max(12),
});

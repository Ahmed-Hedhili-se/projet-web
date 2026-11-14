import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { recordLoginFailure, resetLoginFailures } from '../middlewares/rateLimitLogin';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';
import { AppError } from '../utils/AppError';
import { signToken } from '../utils/jwt';
import { isUniqueViolation } from '../utils/prismaErrors';
import { toPublicUser } from '../utils/serializers';

const BCRYPT_ROUNDS = 10;
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_ROUNDS);

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'This email is already in use.');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user
    .create({
      data: { email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName },
    })
    .catch((err: unknown) => {
      if (isUniqueViolation(err)) throw new AppError(409, 'EMAIL_TAKEN', 'This email is already in use.');
      throw err;
    });

  return { token: signToken(user.id, user.role), user: toPublicUser(user) };
}

export async function login(input: LoginInput, ip: string) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    await recordLoginFailure(ip, input.email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  if (user.isBlocked) throw new AppError(403, 'ACCOUNT_BLOCKED', 'Your account has been blocked.');

  await resetLoginFailures(ip, input.email);
  return { token: signToken(user.id, user.role), user: toPublicUser(user) };
}

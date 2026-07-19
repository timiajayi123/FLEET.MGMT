import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';

export function sessionToken(req: Request) {
  return req.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

export async function requireUser(auth: AuthService, req: Request, roles?: string[]) {
  const user = await auth.fromToken(sessionToken(req));
  if (!user) throw new UnauthorizedException('Authentication required.');
  if (roles && !roles.includes(user.role.code)) {
    throw new ForbiddenException('You do not have permission to perform this action.');
  }
  return user;
}

export const FLEET_MANAGER_ROLES = ['S_ADMIN', 'FM'] as const;
export const TRACKING_VIEW_ROLES = ['S_ADMIN', 'FM'] as const;

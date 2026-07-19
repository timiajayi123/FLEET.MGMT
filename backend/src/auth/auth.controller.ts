import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { LoginDto } from './auth.dto';

function tokenOf(req: Request) {
  return req.headers.cookie?.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`))?.split('=')[1];
}
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
    res.cookie(SESSION_COOKIE, result.token, { httpOnly: true, sameSite: 'lax', secure, expires: result.expiresAt, path: '/' });
    return { user: result.user };
  }
  @Get('me') async me(@Req() req: Request) {
    const user = await this.auth.fromToken(tokenOf(req));
    if (!user) throw new UnauthorizedException('Authentication required.');
    return { user };
  }
  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(tokenOf(req));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { success: true };
  }
}

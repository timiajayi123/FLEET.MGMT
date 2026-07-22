import { Body, Controller, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import type { Request } from 'express';
import { AiService } from './ai.service';
import { AiRateLimitService } from './ai-rate-limit.service';
class AskDto { @IsString() @IsNotEmpty() @MaxLength(1000) message!: string; }
@Controller('ai')
export class AiController { constructor(private readonly auth: AuthService, private readonly ai: AiService, private readonly rateLimit: AiRateLimitService) {} @Post('assistant') async ask(@Req() req: Request, @Body() dto: AskDto) { const user = await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); this.rateLimit.check(user.id); return { data: await this.ai.ask(dto.message, { requestId: req.headers['x-request-id']?.toString().slice(0, 100) || crypto.randomUUID(), userId: user.id, role: user.role.code }) }; } }

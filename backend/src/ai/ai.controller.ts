import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AuthService } from '../auth/auth.service';
import { FLEET_MANAGER_ROLES, requireUser } from '../common/request-auth';
import { Req } from '@nestjs/common';
import type { Request } from 'express';
import { AiService } from './ai.service';
class AskDto { @IsString() @IsNotEmpty() @MaxLength(1000) message!: string; }
@Controller('ai')
export class AiController { constructor(private readonly auth: AuthService, private readonly ai: AiService) {} @Post('assistant') async ask(@Req() req: Request, @Body() dto: AskDto) { await requireUser(this.auth, req, [...FLEET_MANAGER_ROLES]); return { data: await this.ai.ask(dto.message) }; } }

import { Body, Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { requireUser } from '../common/request-auth';
import { CreateDriverRatingDto } from './ratings.dto';
import { RatingsService } from './ratings.service';

@Controller('driver-ratings')
export class RatingsController {
  constructor(
    private readonly ratings: RatingsService,
    private readonly auth: AuthService,
  ) {}

  @Post(':tripId')
  async create(
    @Req() req: Request,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() dto: CreateDriverRatingDto,
  ) {
    const user = await requireUser(this.auth, req);
    return this.ratings.create(tripId, user.id, dto);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverRatingDto } from './ratings.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tripId: string, ratedById: string, dto: CreateDriverRatingDto) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { request: { select: { requesterId: true } }, rating: true },
    });
    if (!trip || !trip.requestId) throw new NotFoundException('Completed trip not found.');
    if (trip.status !== 'COMPLETED')
      throw new BadRequestException('A driver can only be rated after the trip ends.');
    if (trip.request?.requesterId !== ratedById)
      throw new ForbiddenException('Only the requesting staff member can rate this trip.');
    if (trip.rating) throw new BadRequestException('This trip has already been rated.');
    return this.prisma.driverRating.create({
      data: {
        tripId: trip.id,
        requestId: trip.requestId,
        driverId: trip.driverId,
        ratedById,
        stars: dto.stars,
        likedTrip: dto.likedTrip,
        remark: dto.remark?.trim() || null,
        complaint: dto.complaint?.trim() || null,
      },
    });
  }
}

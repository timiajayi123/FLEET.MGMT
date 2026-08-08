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
      },
    });
  }

  async list() {
    const [drivers, recentRatings] = await Promise.all([
      this.prisma.driver.findMany({
        orderBy: { staffName: 'asc' },
        select: {
          id: true,
          staffName: true,
          employeeId: true,
          status: true,
          locationText: true,
          location: { select: { name: true } },
          ratings: { select: { stars: true } },
        },
      }),
      this.prisma.driverRating.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          stars: true,
          likedTrip: true,
          remark: true,
          createdAt: true,
          driver: { select: { id: true, staffName: true, employeeId: true } },
          ratedBy: { select: { staffName: true } },
          request: { select: { requestNumber: true, destination: true } },
          trip: { select: { vehicle: { select: { registrationNumber: true } } } },
        },
      }),
    ]);
    const driverRatings = drivers.map(({ ratings, ...driver }) => {
      const total = ratings.reduce((sum, rating) => sum + rating.stars, 0);
      return {
        ...driver,
        rating: ratings.length ? total / ratings.length : null,
        ratingCount: ratings.length,
      };
    });
    const ratedDrivers = driverRatings.filter((driver) => driver.ratingCount > 0);
    const totalRatings = ratedDrivers.reduce((sum, driver) => sum + driver.ratingCount, 0);
    return {
      metrics: {
        totalDrivers: driverRatings.length,
        ratedDrivers: ratedDrivers.length,
        totalRatings,
      },
      drivers: driverRatings,
      recentRatings,
    };
  }
}

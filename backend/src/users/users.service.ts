import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../auth/auth.service';
import { hashPassword } from '../auth/password';
import { SaveUserDto, UsersQueryDto } from './users.dto';
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: UsersQueryDto) {
    const where: Prisma.UserWhereInput = { status: query.status, OR: query.search ? [
      { staffName: { contains: query.search } }, { email: { contains: query.search } }, { employeeId: { contains: query.search } },
    ] : undefined };
    const [data,total] = await Promise.all([
      this.prisma.user.findMany({ where, select: publicUserSelect, orderBy: { staffName: 'asc' }, skip: (query.page-1)*query.limit, take: query.limit }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total/query.limit) } };
  }
  async create(dto: SaveUserDto) {
    if (!dto.password) throw new BadRequestException('A password is required for a new user.');
    const { password, ...data } = dto;
    try { return await this.prisma.user.create({ data: { ...data, passwordHash: await hashPassword(password) }, select: publicUserSelect }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email or employee ID already exists.'); throw error; }
  }
  async update(id: string, dto: SaveUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found.');
    const { password, ...data } = dto;
    return this.prisma.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) }, select: publicUserSelect });
  }
  async deactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    await this.prisma.session.deleteMany({ where: { userId: id } });
    return this.prisma.user.update({ where: { id }, data: { status: 'INACTIVE' }, select: publicUserSelect });
  }
  async savePassport(id: string, file: Express.Multer.File) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype)) throw new BadRequestException('Passport must be JPEG, PNG, or WebP.');
    return this.prisma.user.update({ where: { id }, data: { passportMimeType: file.mimetype, passportData: Uint8Array.from(file.buffer) }, select: publicUserSelect });
  }
  async passport(id: string) { const user=await this.prisma.user.findUnique({where:{id},select:{passportData:true,passportMimeType:true}}); if(!user?.passportData||!user.passportMimeType) throw new NotFoundException('Passport image not found.'); return user; }
}

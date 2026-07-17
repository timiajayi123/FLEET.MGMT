import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './auth.dto';
import { verifyPassword } from './password';

export const SESSION_COOKIE = 'fleet_session';
export const publicUserSelect = {
  id: true, email: true, staffName: true, employeeId: true, phone: true, status: true, passportMimeType: true,
  roleId: true, locationId: true, directorateId: true, departmentId: true, unitId: true,
  role: { select: { id: true, code: true, name: true } },
  location: { select: { id: true, code: true, name: true } },
  directorate: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  unit: { select: { id: true, code: true, name: true } },
  createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Invalid email or password.');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.prisma.session.create({ data: { tokenHash: this.hash(token), userId: user.id, expiresAt } });
    return { token, expiresAt, user: await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: publicUserSelect }) };
  }
  async fromToken(token?: string) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: this.hash(token) }, include: { user: { select: publicUserSelect } } });
    return session && session.expiresAt > new Date() && session.user.status === 'ACTIVE' ? session.user : null;
  }
  async logout(token?: string) {
    if (token) await this.prisma.session.deleteMany({ where: { tokenHash: this.hash(token) } });
  }
}

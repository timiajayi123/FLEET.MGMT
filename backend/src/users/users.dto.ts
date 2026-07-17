import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { UserStatus } from '../../generated/prisma/enums';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const optionalUuid = ({ value }: { value: unknown }) => value === '' ? undefined : value;
export class SaveUserDto {
  @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email!: string;
  @Transform(trim) @IsString() @Length(2, 150) staffName!: string;
  @Transform(trim) @IsString() @Length(2, 50) employeeId!: string;
  @Transform(trim) @IsOptional() @IsString() phone?: string;
  @IsUUID() roleId!: string;
  @Transform(optionalUuid) @IsOptional() @IsUUID() locationId?: string;
  @Transform(optionalUuid) @IsOptional() @IsUUID() directorateId?: string;
  @Transform(optionalUuid) @IsOptional() @IsUUID() departmentId?: string;
  @Transform(optionalUuid) @IsOptional() @IsUUID() unitId?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsString() @Length(8, 200) password?: string;
}
export class UsersQueryDto {
  @Transform(trim) @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @Transform(({ value }) => value === undefined ? 1 : Number(value)) @IsInt() @Min(1) page = 1;
  @Transform(({ value }) => value === undefined ? 20 : Number(value)) @IsInt() @Min(1) @Max(100) limit = 20;
}

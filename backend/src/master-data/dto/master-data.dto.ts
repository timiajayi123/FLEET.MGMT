import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MasterDataStatus } from '../../../generated/prisma/enums';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SaveMasterDataDto {
  @Transform(trim)
  @IsString()
  @Length(2, 30)
  code!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 150)
  name!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  passengerCapacity?: number;

  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  isSystemRole?: boolean;
}

export class MasterDataQueryDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @Transform(({ value }: { value: unknown }) => (value === undefined ? 1 : Number(value)))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }: { value: unknown }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['name', 'code', 'status', 'sortOrder', 'createdAt'])
  sortBy?: 'name' | 'code' | 'status' | 'sortOrder' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsEnum(MasterDataStatus)
  status?: MasterDataStatus;
}

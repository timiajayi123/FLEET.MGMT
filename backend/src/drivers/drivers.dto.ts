import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { DriverStatus } from '../common/status.constants';

const empty = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class SaveDriverDto {
  @IsOptional() @IsString() serialNumber?: string;
  @IsString() staffName!: string;
  @IsString() employeeId!: string;
  @IsOptional() @IsString() locationText?: string;
  @IsOptional() @IsString() zone?: string;
  @Transform(empty) @IsOptional() @IsIn(['OUTSOURCED', 'PERMANENT STAFF']) category?: string;
  @IsString() phone!: string;
  @Transform(empty) @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() licenceNumber?: string;
  @IsOptional() @IsString() licenceClass?: string;
  @IsOptional() @IsEnum(DriverStatus) status?: DriverStatus;
  @Transform(empty) @IsOptional() @IsUUID() locationId?: string;
}

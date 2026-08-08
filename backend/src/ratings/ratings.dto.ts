import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateDriverRatingDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(5) stars!: number;
  @IsBoolean() likedTrip!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) remark?: string;
}

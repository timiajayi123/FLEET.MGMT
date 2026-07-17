import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 200)
  password!: string;
}

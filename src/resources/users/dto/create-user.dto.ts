import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ 
    description: 'User name', 
    example: 'John Doe',
    minLength: 2 
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ 
    description: 'User email address', 
    example: 'john@example.com' 
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
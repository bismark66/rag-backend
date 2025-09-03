import { ApiProperty } from '@nestjs/swagger';

export class User {
  @ApiProperty({ description: 'User unique identifier', example: 1 })
  id: number;

  @ApiProperty({ description: 'User name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'User email address', example: 'john@example.com' })
  email: string;

  @ApiProperty({ description: 'User creation date', example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'User last update date', example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config({
  path:
    process.env.NODE_ENV === 'production'
      ? undefined
      : ['.env.development', '.env'],
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const configService = new ConfigService();

const AppDatasource = new DataSource({
  type: 'postgres',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  url: configService.get<string>('DATABASE_URL'),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  ssl: configService.get<string>('DATABASE_SSL_ENABLED') === 'true',
  entities: ['dist/src/db/entities/**/*.entity{.ts,.js}'],
  migrations: ['dist/src/db/migrations/*{.ts,.js}'],
  migrationsTableName: 'migrations',
  synchronize: false,
});

AppDatasource.initialize()
  .then(() => {
    console.log('Database connection established successfully✅');
  })
  .catch((error) => {
    console.error('Database connection failed❌', error);
  });

export default AppDatasource;

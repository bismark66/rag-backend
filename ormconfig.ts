import * as dotenv from 'dotenv';

dotenv.config();

const config = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL_ENABLED === 'true',
  entities: ['dist/src/db/entities/*.entity{.ts,.js}'],
  migrations: ['dist/src/db/migrations/*{.ts,.js}'],
  cli: {
    migrationsDir: 'src/db/migrations',
  },
  synchronize: false,
};

module.exports = config;

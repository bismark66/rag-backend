/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';

interface ApiConfig {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  auth?: {
    type: 'basic' | 'bearer' | 'apiKey';
    credentials: string;
  };
  responseMapping?: (data: any) => any;
}

@Injectable()
export class ApiService {
  private readonly logger = new Logger(ApiService.name);
  private readonly apiConfigs: Map<string, ApiConfig> = new Map();

  constructor(
    private readonly httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.initializeApiConfigs();
  }

  private initializeApiConfigs() {
    this.apiConfigs.set('weather', {
      name: 'weather',
      endpoint: 'https://open-weather13.p.rapidapi.com/city',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key':
          this.configService.get<string>('WEATHER_API_KEY') || '',
        'X-RapidAPI-Host': 'open-weather13.p.rapidapi.com',
      },
      responseMapping: (data) => ({
        temperature: data.main.temp, // In Kelvin by default
        temperature_celsius: Math.round(data.main.temp - 273.15), // Convert to Celsius
        temperature_fahrenheit: Math.round(
          ((data.main.temp - 273.15) * 9) / 5 + 32,
        ), // Convert to Fahrenheit
        condition: data.weather[0]?.description || 'Unknown',
        humidity: data.main.humidity,
        wind_speed: data.wind.speed,
        wind_direction: data.wind.deg,
        pressure: data.main.pressure,
        visibility: data.visibility,
        city: data.name,
        country: data.sys?.country,
      }),
    });

    this.apiConfigs.set('news', {
      name: 'news',
      endpoint: 'https://newsapi.org/v2/top-headlines',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      responseMapping: (data) =>
        data.articles.slice(0, 5).map((article) => ({
          title: article.title,
          source: article.source.name,
          publishedAt: article.publishedAt,
        })),
    });

    // Add more API configurations as needed
  }

  async callApi(
    apiName: string,
    params: Record<string, any> = {},
  ): Promise<any> {
    const config = this.apiConfigs.get(apiName);
    if (!config) {
      throw new Error(`API configuration not found for: ${apiName}`);
    }

    try {
      let response: AxiosResponse;
      console.log('params', params);

      switch (config.method) {
        case 'GET':
          response = await firstValueFrom(
            this.httpService.get(config.endpoint, {
              params,
              headers: this.buildHeaders(config),
            }),
          );
          break;

        case 'POST':
          response = await firstValueFrom(
            this.httpService.post(config.endpoint, params, {
              headers: this.buildHeaders(config),
            }),
          );
          break;

        default:
          throw new Error(`Unsupported HTTP method: ${config.method}`);
      }

      // Add specific error handling for OpenWeather API
      if (apiName === 'weather' && response.data.cod !== 200) {
        throw new Error(`Weather API error: ${response.data.message}`);
      }

      return config.responseMapping
        ? config.responseMapping(response.data)
        : response.data;
    } catch (error) {
      this.logger.error(`API call failed for ${apiName}:`, error);
      throw new Error(`Failed to call ${apiName} API`);
    }
  }

  private buildHeaders(config: ApiConfig): Record<string, string> {
    const headers = { ...config.headers };

    // if (config.auth) {
    //   switch (config.auth.type) {
    //     case 'bearer':
    //       headers['Authorization'] = `Bearer ${config.auth.credentials}`;
    //       break;
    //     case 'basic':
    //       headers['Authorization'] = `Basic ${config.auth.credentials}`;
    //       break;
    //     case 'apiKey':
    //       headers['x-rapidapi-key'] = config.auth.credentials;
    //       break;
    //   }
    // }

    return headers;
  }

  getAvailableApis(): string[] {
    return Array.from(this.apiConfigs.keys());
  }
}

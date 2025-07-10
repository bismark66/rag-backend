import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { IngestUrlDto } from './dto/ingest-url.dto';
import { IngestTextDto } from './dto/ingest-text.dto';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('ingest/url')
  @ApiOperation({ summary: 'Ingest documents from a URL' })
  @ApiResponse({ status: 201, description: 'Documents ingested successfully' })
  @ApiBody({ type: IngestUrlDto })
  async ingestFromUrl(@Body() ingestUrlDto: IngestUrlDto) {
    return this.documentsService.ingestFromUrl(
      ingestUrlDto.url,
      ingestUrlDto.selector,
    );
  }

  @Post('ingest/text')
  @ApiOperation({ summary: 'Ingest text documents directly' })
  @ApiResponse({
    status: 201,
    description: 'Text documents ingested successfully',
  })
  @ApiBody({ type: IngestTextDto })
  async ingestText(@Body() ingestTextDto: IngestTextDto) {
    return this.documentsService.ingestText(ingestTextDto.texts);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search similar documents' })
  @ApiResponse({
    status: 200,
    description: 'Similar documents retrieved successfully',
  })
  @ApiQuery({ name: 'query', description: 'Search query' })
  @ApiQuery({
    name: 'k',
    description: 'Number of results to return',
    required: false,
  })
  async searchSimilar(@Query('query') query: string, @Query('k') k?: number) {
    return this.documentsService.searchSimilar(query, k ?? 4); // Use nullish coalescing (??)
  }
}

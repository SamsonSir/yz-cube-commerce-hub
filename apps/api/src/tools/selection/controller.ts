import {Body, Controller, Get, Param, Post, Query, Req, UseGuards} from '@nestjs/common';
import type {Request} from 'express';
import {LocalizationGuard} from '../../localization';
import type {LocalizationContext} from '../../localization-platform';
import {SelectionService} from './selection';

type SelectionRequest = Request & {localization: LocalizationContext};

@Controller('localization/selection')
@UseGuards(LocalizationGuard)
export class SelectionController {
  constructor(private readonly selection: SelectionService) {}

  @Get('datasets')
  datasets(@Req() request: SelectionRequest, @Query('dataset') linkedId: unknown) {
    return this.selection.datasets(request.localization.owner, linkedId);
  }

  @Get('datasets/:id/products')
  products(@Req() request: SelectionRequest, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.selection.products(request.localization.owner, id, query);
  }

  @Get('datasets/:id/analyses')
  analyses(@Req() request: SelectionRequest, @Param('id') id: string) {
    return this.selection.analyses(request.localization.owner, id);
  }

  @Post('datasets/:id/analyses')
  analyze(@Req() request: SelectionRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.selection.analyze(request.localization, id, body);
  }

  @Get('shops/:id/profile')
  shopProfile(@Req() request: SelectionRequest, @Param('id') id: string) {
    return this.selection.shopProfile(request.localization, id);
  }

  @Post('analyses/:id/retry')
  retry(@Req() request: SelectionRequest, @Param('id') id: string) {
    return this.selection.retryAnalysis(request.localization.owner, id);
  }

  @Post('datasets/:id/drafts')
  follow(@Req() request: SelectionRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.selection.follow(request.localization, id, body);
  }

  @Get('drafts/:id/origin')
  origin(@Req() request: SelectionRequest, @Param('id') id: string) {
    return this.selection.origin(request.localization.owner, id);
  }

  @Post('drafts/:id/copy')
  copy(@Req() request: SelectionRequest, @Param('id') id: string) {
    return this.selection.retryCopy(request.localization.owner, id);
  }
}

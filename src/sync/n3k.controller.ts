import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { N3kService } from './n3k.service';

@Controller('api/d/m5')
export class N3kController {
  constructor(private readonly n3kService: N3kService) {}

  @Post('x')
  async process(@Body() body: any) {
    return this.n3kService.process(body.uid, body.iid, body.val);
  }

  @Post('r/:id')
  async reverse(@Param('id') id: string) {
    return this.n3kService.reverse(id);
  }

  @Get('h/:uid')
  async getHistory(@Param('uid') uid: string, @Query('lim') limit: number = 50) {
    return this.n3kService.getHistory(uid, limit);
  }

  @Get('v/:id')
  async validate(@Param('id') id: string) {
    return this.n3kService.validate(id);
  }
}

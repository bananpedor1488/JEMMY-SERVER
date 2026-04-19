import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { Q7xService } from './q7x.service';

@Controller('api/d/k8')
export class Q7xController {
  constructor(private readonly q7xService: Q7xService) {}

  @Post('p')
  async processAction(@Body() body: any) {
    return this.q7xService.processAction(body.src, body.dst, body.val);
  }

  @Get('h/:uid')
  async getHistory(@Param('uid') uid: string, @Query('lim') limit: number = 50) {
    return this.q7xService.getHistory(uid, limit);
  }

  @Get('v/:id')
  async validate(@Param('id') id: string) {
    return this.q7xService.validate(id);
  }

  @Post('c/:id')
  async cancel(@Param('id') id: string) {
    return this.q7xService.cancel(id);
  }
}

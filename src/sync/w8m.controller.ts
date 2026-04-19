import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { W8mService } from './w8m.service';

@Controller('api/d/r3')
export class W8mController {
  constructor(private readonly w8mService: W8mService) {}

  @Get('g/:uid')
  async getValue(@Param('uid') uid: string) {
    return this.w8mService.getValue(uid);
  }

  @Get('i/:uid')
  async getInfo(@Param('uid') uid: string) {
    return this.w8mService.getInfo(uid);
  }

  @Post('a')
  async addValue(@Body() body: any) {
    return this.w8mService.addValue(body.uid, body.val, body.src);
  }
}

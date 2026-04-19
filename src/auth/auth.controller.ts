import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('check-device/:deviceId')
  async checkDevice(@Param('deviceId') deviceId: string) {
    return this.authService.checkDevice(deviceId);
  }

  @Post('register')
  async register(@Body() body: { device_id: string; public_key: string }) {
    return this.authService.registerDevice(body.device_id, body.public_key);
  }

  @Post('toggle-ephemeral')
  async toggleEphemeral(@Body() body: { device_id: string; enabled: boolean }) {
    return this.authService.toggleEphemeralIdentity(body.device_id, body.enabled);
  }
}

@Controller('account')
export class AccountController {
  constructor(private readonly authService: AuthService) {}

  @Post('delete')
  async deleteAccount(@Body() body: { device_id: string }) {
    console.log('🗑️ Delete account request for device:', body.device_id);
    return this.authService.deleteAccount(body.device_id);
  }
}

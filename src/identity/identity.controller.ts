import { Controller, Post, Body, Get, Param, Patch, Delete } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IdentityService } from './identity.service';

@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('toggle-ephemeral')
  async toggleEphemeral(@Body() body: { user_id: string; enabled: boolean }) {
    return this.identityService.toggleEphemeralMode(body.user_id, body.enabled);
  }

  @Get('user/:user_id')
  async getActiveIdentity(@Param('user_id') user_id: string) {
    return this.identityService.getActiveIdentity(user_id);
  }

  @Get(':identity_id/status')
  async getStatus(@Param('identity_id') identity_id: string) {
    const identity = await this.identityService.getIdentityById(identity_id);
    if (!identity) {
      return { is_online: false, last_seen: null };
    }
    return {
      is_online: identity.is_online,
      last_seen: identity.last_seen,
    };
  }

  @Post('generate-link')
  async generateInviteLink(@Body() body: { identity_id: string }) {
    const identity = await this.identityService.getIdentityById(body.identity_id);
    if (!identity) {
      return { error: 'Identity not found' };
    }

    const token = this.identityService.generateInviteToken(body.identity_id);
    const url = `https://weeky-six.vercel.app/api/u/${token}`;

    return {
      token,
      url,
      expires_at: null, // Tokens don't expire for now
    };
  }

  @Get('invite/preview/:token')
  async previewInviteLink(@Param('token') token: string) {
    const identity = await this.identityService.getIdentityByInviteToken(token);
    if (!identity) {
      return { error: 'Invalid or expired invite link' };
    }

    return {
      identity: {
        id: identity._id.toString(),
        username: identity.username,
        avatar_seed: identity.avatar_seed,
        bio: '', // Add bio field if needed
      },
    };
  }

  // Privacy settings endpoints
  @Patch('privacy/update')
  async updatePrivacySettings(@Body() body: { identity_id: string; settings: any }) {
    const identity = await this.identityService.updatePrivacySettings(body.identity_id, body.settings);
    return {
      success: true,
      privacy_settings: identity.privacy_settings,
    };
  }

  @Get('privacy/:identity_id')
  async getPrivacySettings(@Param('identity_id') identity_id: string) {
    const settings = await this.identityService.getPrivacySettings(identity_id);
    return { privacy_settings: settings };
  }

  // Blocked users endpoints
  @Post('block')
  async blockUser(@Body() body: { blocker_identity_id: string; blocked_identity_id: string }) {
    return this.identityService.blockUser(body.blocker_identity_id, body.blocked_identity_id);
  }

  @Post('unblock')
  async unblockUser(@Body() body: { blocker_identity_id: string; blocked_identity_id: string }) {
    return this.identityService.unblockUser(body.blocker_identity_id, body.blocked_identity_id);
  }

  @Get('blocked-list/:identity_id')
  async getBlockedUsers(@Param('identity_id') identity_id: string) {
    const blocked = await this.identityService.getBlockedUsers(identity_id);
    console.log(`📋 Blocked users for ${identity_id}:`, blocked.length);
    return { blocked_users: blocked };
  }

  @Get('can-message/:from_id/:to_id')
  async canMessage(@Param('from_id') from_id: string, @Param('to_id') to_id: string) {
    const canMessage = await this.identityService.canMessage(from_id, to_id);
    return { can_message: canMessage };
  }

  @Get('am-i-blocked/:my_id/:other_id')
  async amIBlocked(@Param('my_id') my_id: string, @Param('other_id') other_id: string) {
    const isBlocked = await this.identityService.isBlockedBy(my_id, other_id);
    return { is_blocked: isBlocked };
  }

  @Get('search/:username')
  async searchByUsername(
    @Param('username') username: string,
    @Query('current_identity_id') currentIdentityId?: string
  ) {
    const results = await this.identityService.searchByUsername(username, currentIdentityId);
    return { results };
  }

  @Get('can-see-profile/:viewer_id/:target_id')
  async canSeeProfile(@Param('viewer_id') viewer_id: string, @Param('target_id') target_id: string) {
    const canSee = await this.identityService.canSeeProfile(viewer_id, target_id);
    return { can_see: canSee };
  }

  @Delete(':identity_id')
  async deleteIdentity(@Param('identity_id') identity_id: string) {
    const result = await this.identityService.deleteIdentity(identity_id);
    if (!result) {
      return { error: 'Identity not found' };
    }
    return { success: true, message: 'Identity deleted successfully' };
  }
}
}

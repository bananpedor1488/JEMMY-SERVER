import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Identity } from '../schemas/identity.schema';
import { User } from '../schemas/user.schema';
import { BlockedUser } from '../schemas/blocked-user.schema';

@Injectable()
export class IdentityService {
  constructor(
    @InjectModel(Identity.name) private identityModel: Model<Identity>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(BlockedUser.name) private blockedUserModel: Model<BlockedUser>,
  ) {}

  async createIdentity(user_id: Types.ObjectId, public_key: string, ephemeral: boolean) {
    const username = this.generateUsername();
    const avatar_seed = this.generateAvatarSeed();
    const expires_at = ephemeral ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const identity = new this.identityModel({
      user_id,
      username,
      avatar_seed,
      public_key,
      is_active: true,
      expires_at,
    });

    return identity.save();
  }

  async getCurrentIdentity(user_id: Types.ObjectId) {
    return this.identityModel.findOne({ user_id, is_active: true });
  }

  async getActiveIdentity(user_id: string) {
    return this.identityModel.findOne({ user_id: new Types.ObjectId(user_id), is_active: true });
  }

  async getIdentityById(identity_id: string) {
    return this.identityModel.findById(identity_id);
  }

  async setOnline(identity_id: string) {
    return this.identityModel.findByIdAndUpdate(
      identity_id,
      { 
        is_online: true,
        last_seen: new Date()
      },
      { new: true }
    );
  }

  async setOffline(identity_id: string) {
    return this.identityModel.findByIdAndUpdate(
      identity_id,
      { 
        is_online: false,
        last_seen: new Date()
      },
      { new: true }
    );
  }

  async toggleEphemeralMode(user_id: string, enabled: boolean) {
    const user = await this.userModel.findById(user_id);
    if (!user) throw new Error('User not found');

    user.ephemeral_identity_enabled = enabled;
    await user.save();

    if (enabled) {
      await this.rotateIdentity(user._id);
    } else {
      await this.makeIdentityPermanent(user.current_identity_id);
    }

    return { success: true, ephemeral_enabled: enabled };
  }

  async rotateIdentity(user_id: Types.ObjectId) {
    await this.identityModel.updateMany({ user_id }, { is_active: false });

    const user = await this.userModel.findById(user_id);
    const newIdentity = await this.createIdentity(user_id, this.generatePublicKey(), user.ephemeral_identity_enabled);

    user.current_identity_id = newIdentity._id;
    await user.save();

    console.log(`🔄 Личность обновлена: ${newIdentity.username}`);

    return newIdentity;
  }

  async makeIdentityPermanent(identity_id: Types.ObjectId) {
    return this.identityModel.findByIdAndUpdate(identity_id, { expires_at: null });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleIdentityRotation() {
    const expiredIdentities = await this.identityModel.find({
      expires_at: { $lt: new Date() },
      is_active: true,
    });

    console.log(`🔄 Проверка ротации: найдено ${expiredIdentities.length} истекших личностей`);

    for (const identity of expiredIdentities) {
      await this.rotateIdentity(identity.user_id);
      console.log(`✅ Личность обновлена для user ${identity.user_id}`);
    }
  }

  private generateUsername(): string {
    const adjectives = ['Silent', 'Ghost', 'Shadow', 'Phantom', 'Mystic', 'Cosmic', 'Neon', 'Cyber'];
    const nouns = ['Wolf', 'Raven', 'Fox', 'Tiger', 'Dragon', 'Phoenix', 'Viper', 'Hawk'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 9999);
    return `${adj}${noun}${num}`;
  }

  private generateAvatarSeed(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generatePublicKey(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Invite link methods
  generateInviteToken(identity_id: string): string {
    // Simple token: base64(identity_id + timestamp + random)
    const data = `${identity_id}:${Date.now()}:${Math.random().toString(36).substring(2)}`;
    return Buffer.from(data).toString('base64url');
  }

  parseInviteToken(token: string): string | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length >= 1) {
        return parts[0]; // identity_id
      }
      return null;
    } catch (e) {
      console.error('Failed to parse invite token:', e);
      return null;
    }
  }

  async getIdentityByInviteToken(token: string) {
    const identity_id = this.parseInviteToken(token);
    if (!identity_id) {
      return null;
    }
    return this.getIdentityById(identity_id);
  }

  // Privacy settings methods
  async updatePrivacySettings(identity_id: string, settings: Partial<Identity['privacy_settings']>) {
    const identity = await this.identityModel.findById(identity_id);
    if (!identity) {
      throw new Error('Identity not found');
    }

    identity.privacy_settings = {
      ...identity.privacy_settings,
      ...settings,
    };

    await identity.save();
    return identity;
  }

  async getPrivacySettings(identity_id: string) {
    const identity = await this.identityModel.findById(identity_id);
    if (!identity) {
      throw new Error('Identity not found');
    }
    return identity.privacy_settings;
  }

  // Blocked users methods
  async blockUser(blocker_identity_id: string, blocked_identity_id: string) {
    const existing = await this.blockedUserModel.findOne({
      blocker_identity_id: new Types.ObjectId(blocker_identity_id),
      blocked_identity_id: new Types.ObjectId(blocked_identity_id),
    });

    if (existing) {
      return { success: true, message: 'User already blocked' };
    }

    const blocked = new this.blockedUserModel({
      blocker_identity_id: new Types.ObjectId(blocker_identity_id),
      blocked_identity_id: new Types.ObjectId(blocked_identity_id),
    });

    await blocked.save();
    console.log(`🚫 User ${blocked_identity_id} blocked by ${blocker_identity_id}`);
    return { success: true, message: 'User blocked' };
  }

  async unblockUser(blocker_identity_id: string, blocked_identity_id: string) {
    await this.blockedUserModel.deleteOne({
      blocker_identity_id: new Types.ObjectId(blocker_identity_id),
      blocked_identity_id: new Types.ObjectId(blocked_identity_id),
    });

    console.log(`✅ User ${blocked_identity_id} unblocked by ${blocker_identity_id}`);
    return { success: true, message: 'User unblocked' };
  }

  async getBlockedUsers(identity_id: string) {
    const blocked = await this.blockedUserModel
      .find({ blocker_identity_id: new Types.ObjectId(identity_id) })
      .populate('blocked_identity_id')
      .lean(); // Convert to plain JavaScript objects

    console.log(`📋 Found ${blocked.length} blocked users for ${identity_id}`);

    // Extract and format the identities
    const identities = blocked
      .map(b => b.blocked_identity_id as any) // Type assertion for populated field
      .filter(identity => identity != null)
      .map((identity: any) => {
        const formatted = {
          _id: identity._id.toString(),
          username: identity.username,
          avatar: identity.avatar_seed || '', // Use avatar_seed as avatar
          bio: identity.bio || '',
          avatar_updated_at: identity.avatar_updated_at,
          is_online: identity.is_online,
          last_seen: identity.last_seen,
          expires_at: identity.expires_at,
        };
        console.log(`  - ${formatted.username} (${formatted._id})`);
        return formatted;
      });

    return identities;
  }

  async isBlocked(blocker_identity_id: string, blocked_identity_id: string): Promise<boolean> {
    const blocked = await this.blockedUserModel.findOne({
      blocker_identity_id: new Types.ObjectId(blocker_identity_id),
      blocked_identity_id: new Types.ObjectId(blocked_identity_id),
    });

    return !!blocked;
  }

  async isBlockedBy(my_identity_id: string, other_identity_id: string): Promise<boolean> {
    // Check if other_identity_id has blocked my_identity_id
    return this.isBlocked(other_identity_id, my_identity_id);
  }

  async searchByUsername(query: string, currentIdentityId?: string): Promise<Identity[]> {
    // Убираем @ если есть
    const cleanQuery = query.startsWith('@') ? query.substring(1) : query;
    
    console.log(`🔍 Searching for username: "${cleanQuery}", excluding: ${currentIdentityId || 'none'}`);
    
    // Создаем фильтр для поиска
    const filter: any = {
      username: new RegExp(`^${cleanQuery}`, 'i'), // case-insensitive, начинается с query
      is_active: true
    };
    
    // Исключаем текущего пользователя из результатов
    if (currentIdentityId) {
      filter._id = { $ne: new Types.ObjectId(currentIdentityId) };
    }
    
    // Ищем все identity с похожим username (case-insensitive)
    const results = await this.identityModel
      .find(filter)
      .limit(20) // Ограничиваем результаты
      .lean();
    
    console.log(`✅ Found ${results.length} results`);
    
    return results.map(identity => ({
      ...identity,
      _id: identity._id.toString(),
      id: identity._id.toString()
    })) as any[];
  }

  async canMessage(from_identity_id: string, to_identity_id: string): Promise<boolean> {
    // Check if blocked
    const isBlocked = await this.isBlocked(to_identity_id, from_identity_id);
    if (isBlocked) {
      return false;
    }

    // Check privacy settings
    const toIdentity = await this.identityModel.findById(to_identity_id);
    if (!toIdentity) {
      return false;
    }

    const whoCanMessage = toIdentity.privacy_settings?.who_can_message || 'everyone';

    if (whoCanMessage === 'everyone') {
      return true;
    }

    if (whoCanMessage === 'nobody') {
      return false;
    }

    // For 'contacts' - check if they have an existing chat
    // This is a simplified version, you might want to implement a proper contacts system
    return true; // For now, allow if not blocked
  }

  async canSeeProfile(viewer_identity_id: string, target_identity_id: string): Promise<boolean> {
    const targetIdentity = await this.identityModel.findById(target_identity_id);
    if (!targetIdentity) {
      return false;
    }

    const whoCanSee = targetIdentity.privacy_settings?.who_can_see_profile || 'everyone';

    if (whoCanSee === 'everyone') {
      return true;
    }

    if (whoCanSee === 'nobody') {
      return false;
    }

    // For 'contacts' - implement contact check
    return true;
  }

  async canSeeOnlineStatus(viewer_identity_id: string, target_identity_id: string): Promise<boolean> {
    const targetIdentity = await this.identityModel.findById(target_identity_id);
    if (!targetIdentity) {
      return false;
    }

    const whoCanSee = targetIdentity.privacy_settings?.who_can_see_online || 'everyone';

    if (whoCanSee === 'everyone') {
      return true;
    }

    if (whoCanSee === 'nobody') {
      return false;
    }

    return true;
  }

  async canSeeLastSeen(viewer_identity_id: string, target_identity_id: string): Promise<boolean> {
    const targetIdentity = await this.identityModel.findById(target_identity_id);
    if (!targetIdentity) {
      return false;
    }

    const whoCanSee = targetIdentity.privacy_settings?.who_can_see_last_seen || 'everyone';

    if (whoCanSee === 'everyone') {
      return true;
    }

    if (whoCanSee === 'nobody') {
      return false;
    }

    return true;
  }

  async deleteAllIdentitiesForUser(user_id: Types.ObjectId) {
    console.log('🗑️ Deleting all identities for user:', user_id);
    const result = await this.identityModel.deleteMany({ user_id });
    console.log(`✅ Deleted ${result.deletedCount} identities`);
    return result;
  }

  async deleteIdentity(identity_id: string) {
    console.log('🗑️ Deleting identity:', identity_id);
    const result = await this.identityModel.findByIdAndDelete(identity_id);
    if (result) {
      console.log('✅ Identity deleted successfully');
      // Also delete associated blocked user records
      await this.blockedUserModel.deleteMany({
        $or: [
          { blocker_identity_id: new Types.ObjectId(identity_id) },
          { blocked_identity_id: new Types.ObjectId(identity_id) }
        ]
      });
    }
    return result;
  }
}

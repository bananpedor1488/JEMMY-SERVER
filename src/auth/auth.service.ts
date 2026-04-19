import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';
import { IdentityService } from '../identity/identity.service';
import { UData } from '../schemas/u_data.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UData.name) private uDataModel: Model<UData>,
    private identityService: IdentityService,
  ) {}

  async checkDevice(device_id: string) {
    const user = await this.userModel.findOne({ device_id });
    
    if (!user) {
      return { exists: false };
    }

    const identity = await this.identityService.getCurrentIdentity(user._id);
    
    return {
      exists: true,
      user_id: user._id,
      identity: identity,
    };
  }

  async registerDevice(device_id: string, public_key: string) {
    let user = await this.userModel.findOne({ device_id });
    
    if (!user) {
      user = new this.userModel({ device_id, ephemeral_identity_enabled: false });
      await user.save();
      
      const identity = await this.identityService.createIdentity(user._id, public_key, false);
      user.current_identity_id = identity._id;
      await user.save();

      const existingData = await this.uDataModel.findOne({ uid: user._id.toString() });
      if (!existingData) {
        const uData = new this.uDataModel({
          uid: user._id.toString(),
          p: 100,
          q: 0,
          r: 'JEM',
        });
        await uData.save();
      }
    }

    return {
      user_id: user._id,
      identity: await this.identityService.getCurrentIdentity(user._id),
    };
  }

  async toggleEphemeralIdentity(device_id: string, enabled: boolean) {
    const user = await this.userModel.findOne({ device_id });
    if (!user) throw new Error('User not found');

    user.ephemeral_identity_enabled = enabled;
    await user.save();

    if (enabled) {
      await this.identityService.rotateIdentity(user._id);
    } else {
      await this.identityService.makeIdentityPermanent(user.current_identity_id);
    }

    return { success: true, ephemeral_enabled: enabled };
  }

  async deleteAccount(device_id: string) {
    console.log('🗑️ Deleting account for device:', device_id);
    
    const user = await this.userModel.findOne({ device_id });
    if (!user) {
      console.log('❌ User not found:', device_id);
      throw new Error('User not found');
    }

    console.log('✅ Found user:', user._id);
    
    // Delete all identities for this user
    await this.identityService.deleteAllIdentitiesForUser(user._id);
    
    // Delete the user
    await this.userModel.deleteOne({ _id: user._id });
    
    console.log('✅ Account deleted successfully');
    return { success: true, message: 'Account deleted successfully' };
  }
}

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Identity } from '../schemas/identity.schema';
import { User } from '../schemas/user.schema';
import { IdentityService } from './identity.service';

@Injectable()
export class IdentityRotationService {
  constructor(
    @InjectModel(Identity.name) private identityModel: Model<Identity>,
    @InjectModel(User.name) private userModel: Model<User>,
    private identityService: IdentityService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async rotateExpiredIdentities() {
    const now = new Date();
    const expiredIdentities = await this.identityModel.find({
      expires_at: { $lte: now },
      is_active: true,
    });

    for (const identity of expiredIdentities) {
      const user = await this.userModel.findById(identity.user_id);
      if (!user || !user.ephemeral_identity_enabled) continue;

      identity.is_active = false;
      await identity.save();

      const newIdentity = await this.identityService.createIdentity(
        user._id,
        identity.public_key,
        true,
      );

      user.current_identity_id = newIdentity._id;
      await user.save();

      console.log(`🔄 Identity rotated for user ${user._id}`);
    }
  }
}

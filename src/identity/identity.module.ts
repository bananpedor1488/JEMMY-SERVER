import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { IdentityRotationService } from './identity-rotation.service';
import { Identity, IdentitySchema } from '../schemas/identity.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { BlockedUser, BlockedUserSchema } from '../schemas/blocked-user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Identity.name, schema: IdentitySchema },
      { name: User.name, schema: UserSchema },
      { name: BlockedUser.name, schema: BlockedUserSchema },
    ]),
  ],
  controllers: [IdentityController],
  providers: [IdentityService, IdentityRotationService],
  exports: [IdentityService],
})
export class IdentityModule {}

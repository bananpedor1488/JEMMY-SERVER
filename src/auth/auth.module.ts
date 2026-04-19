import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController, AccountController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema } from '../schemas/user.schema';
import { IdentityModule } from '../identity/identity.module';
import { UData, UDataSchema } from '../schemas/u_data.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UData.name, schema: UDataSchema },
    ]),
    IdentityModule,
  ],
  controllers: [AuthController, AccountController],
  providers: [AuthService],
})
export class AuthModule {}

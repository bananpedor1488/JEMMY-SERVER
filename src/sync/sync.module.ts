import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UData, UDataSchema } from '../schemas/u_data.schema';
import { ULog, ULogSchema } from '../schemas/u_log.schema';
import { UItem, UItemSchema } from '../schemas/u_item.schema';
import { W8mController } from './w8m.controller';
import { Q7xController } from './q7x.controller';
import { N3kController } from './n3k.controller';
import { W8mService } from './w8m.service';
import { Q7xService } from './q7x.service';
import { N3kService } from './n3k.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UData.name, schema: UDataSchema },
      { name: ULog.name, schema: ULogSchema },
      { name: UItem.name, schema: UItemSchema },
    ]),
  ],
  controllers: [W8mController, Q7xController, N3kController],
  providers: [W8mService, Q7xService, N3kService],
  exports: [W8mService, Q7xService, N3kService],
})
export class SyncModule {}

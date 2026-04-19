import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UData } from '../schemas/u_data.schema';
import { ULog } from '../schemas/u_log.schema';
import { UItem } from '../schemas/u_item.schema';

@Injectable()
export class N3kService {
  constructor(
    @InjectModel(UData.name) private uDataModel: Model<UData>,
    @InjectModel(ULog.name) private uLogModel: Model<ULog>,
    @InjectModel(UItem.name) private uItemModel: Model<UItem>,
  ) {}

  async process(uid: string, iid: string, val: number) {
    if (val <= 0) throw new Error('Invalid value');

    const session = await this.uDataModel.db.startSession();
    session.startTransaction();

    try {
      const data = await this.uDataModel.findOne({ uid }).session(session);
      if (!data || data.p < val) {
        throw new Error('Insufficient data');
      }

      data.p -= val;
      data.q += val;
      await data.save({ session });

      const item = new this.uItemModel({
        uid,
        b: iid,
        c: `i_${iid}`,
        e: val,
        n: '',
        o: 'P',
      });
      await item.save({ session });

      const log = new this.uLogModel({
        k: 'I',
        f: uid,
        g: null,
        h: val,
        j: 'C',
        z: { iid },
        w: new Date(),
      });
      await log.save({ session });

      item.n = log._id.toString();
      await item.save({ session });

      data.q -= val;
      await data.save({ session });

      item.o = 'C';
      await item.save({ session });

      await session.commitTransaction();

      return {
        ok: true,
        iid: item._id,
        itm: item,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async reverse(id: string) {
    const item = await this.uItemModel.findById(id);
    if (!item) throw new Error('Not found');
    if (item.o === 'R') throw new Error('Already reversed');

    const data = await this.uDataModel.findOne({ uid: item.uid });
    if (!data) throw new Error('Data not found');

    data.p += item.e;
    await data.save();

    item.o = 'R';
    await item.save();

    const log = new this.uLogModel({
      k: 'R',
      f: null,
      g: item.uid,
      h: item.e,
      j: 'C',
      z: { oid: id },
      w: new Date(),
    });
    await log.save();

    return { ok: true };
  }

  async getHistory(uid: string, limit: number) {
    return this.uItemModel
      .find({ uid })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async validate(id: string) {
    const item = await this.uItemModel.findById(id);
    return { vld: !!item && item.o === 'C' };
  }
}

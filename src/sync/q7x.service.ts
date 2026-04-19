import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UData } from '../schemas/u_data.schema';
import { ULog } from '../schemas/u_log.schema';

@Injectable()
export class Q7xService {
  constructor(
    @InjectModel(UData.name) private uDataModel: Model<UData>,
    @InjectModel(ULog.name) private uLogModel: Model<ULog>,
  ) {}

  async processAction(src: string, dst: string, val: number) {
    if (src === dst) throw new Error('Invalid operation');
    if (val <= 0) throw new Error('Invalid value');

    const session = await this.uDataModel.db.startSession();
    session.startTransaction();

    try {
      const srcData = await this.uDataModel.findOne({ uid: src }).session(session);
      if (!srcData || srcData.p < val) {
        throw new Error('Insufficient data');
      }

      const dstData = await this.uDataModel.findOne({ uid: dst }).session(session);
      if (!dstData) throw new Error('Target not found');

      const log = new this.uLogModel({
        k: 'T',
        f: src,
        g: dst,
        h: val,
        j: 'P',
        z: {},
      });
      await log.save({ session });

      srcData.p -= val;
      dstData.p += val;

      await srcData.save({ session });
      await dstData.save({ session });

      log.j = 'C';
      log.w = new Date();
      await log.save({ session });

      await session.commitTransaction();

      return {
        ok: true,
        lid: log._id,
        nval: srcData.p,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getHistory(uid: string, limit: number) {
    return this.uLogModel
      .find({
        $or: [{ f: uid }, { g: uid }],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async validate(id: string) {
    const log = await this.uLogModel.findById(id);
    return { vld: !!log && log.j === 'C' };
  }

  async cancel(id: string) {
    const log = await this.uLogModel.findById(id);
    if (!log) throw new Error('Not found');
    if (log.j !== 'P') throw new Error('Cannot cancel');

    log.j = 'X';
    await log.save();

    return { ok: true };
  }
}

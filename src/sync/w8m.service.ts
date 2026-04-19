import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UData } from '../schemas/u_data.schema';

@Injectable()
export class W8mService {
  constructor(
    @InjectModel(UData.name) private uDataModel: Model<UData>,
  ) {}

  async getValue(uid: string) {
    const data = await this.uDataModel.findOne({ uid });
    if (!data) throw new Error('Not found');

    return {
      val: data.p,
      typ: data.r,
    };
  }

  async getInfo(uid: string) {
    const data = await this.uDataModel.findOne({ uid });
    if (!data) throw new Error('Not found');

    return {
      uid: data.uid,
      pts: data.p,
      lck: data.q,
      typ: data.r,
      ts: data.createdAt,
    };
  }

  async addValue(uid: string, val: number, src: string) {
    if (val <= 0) throw new Error('Invalid value');

    const data = await this.uDataModel.findOne({ uid });
    if (!data) throw new Error('Not found');

    data.p += val;
    await data.save();

    return { ok: true, nval: data.p };
  }
}

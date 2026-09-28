import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  create(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findByEmail(email: string, withPassword = false) {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    return withPassword ? query.select('+password') : query;
  }

  findById(id: string) {
    return this.userModel.findById(id);
  }
}

import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(userData: RegisterDto) {
    const exists = await this.usersService.findByEmail(userData.email);
    if (exists) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await this.usersService.create({
      email: userData.email,
      password: hashedPassword,
    });

    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '@/database/data-source';
import { User, UserRole, Business } from '@/database/entities';
import { APIError } from '@/utils/errors';
import { Repository } from 'typeorm';

export interface SignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  businessName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    business: {
      id: string;
      name: string;
    };
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class AuthService {
  private userRepo: Repository<User>;
  private businessRepo: Repository<Business>;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
    this.businessRepo = AppDataSource.getRepository(Business);
  }

  async signup(payload: SignupPayload): Promise<AuthResponse> {
    const { firstName, lastName, email, password, businessName } = payload;

    // Check if user already exists
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      throw new APIError(409, 'User already exists with this email');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate subdomain from business name
    const subdomain = businessName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 63);

    // Create business
    const business = this.businessRepo.create({
      name: businessName,
      subdomain: `${subdomain}-${Date.now().toString(36)}`,
    });
    await this.businessRepo.save(business);

    // Create user
    const user = this.userRepo.create({
      firstName,
      lastName,
      email,
      passwordHash,
      role: UserRole.ADMIN,
      business,
      businessId: business.id,
    });
    await this.userRepo.save(user);

    return this.generateAuthResponse(user, business);
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { email, password } = payload;

    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['business'],
    });

    if (!user) {
      throw new APIError(401, 'Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new APIError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new APIError(403, 'User account is disabled');
    }

    // Update last login
    user.lastLogin = new Date();
    await this.userRepo.save(user);

    return this.generateAuthResponse(user, user.business);
  }

  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
      const decoded = jwt.verify(token, secret) as any;

      const user = await this.userRepo.findOne({
        where: { id: decoded.userId },
        relations: ['business'],
      });

      if (!user || !user.isActive) {
        throw new APIError(401, 'Invalid token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new APIError(401, 'Invalid or expired token');
    }
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new APIError(404, 'User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new APIError(401, 'Old password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  private generateAuthResponse(user: User, business: Business): AuthResponse {
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        business: {
          id: business.id,
          name: business.name,
        },
      },
      tokens: this.generateTokens(user),
    };
  }

  private generateTokens(user: User) {
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    const payload = {
      userId: user.id,
      businessId: user.businessId,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, secret, { expiresIn });
    const refreshToken = jwt.sign(payload, secret, { expiresIn: '30d' });

    return { accessToken, refreshToken };
  }
}

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles, RolesGuard } from './roles.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login using Employee ID, Email, or Mobile' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SYSTEM_ADMIN', 'MANAGEMENT')
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
  })
  getProfile(@Request() req) {
    return req.user;
  }

  @Public()
  @Post('seed')
  @ApiOperation({ summary: 'Manually run database seed' })
  async seed() {
    const { execSync } = require('child_process');
    const path = require('path');
    try {
      const output = execSync('node prisma/seed.js', { cwd: path.join(__dirname, '../../') }).toString();
      return { success: true, output };
    } catch (e) {
      return { success: false, error: e.message, output: e.stdout ? e.stdout.toString() : '', stderr: e.stderr ? e.stderr.toString() : '' };
    }
  }
}

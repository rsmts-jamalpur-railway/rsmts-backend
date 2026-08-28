import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UploadService {
  private isCloudinaryConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const cloudinaryUrl = this.configService.get<string>('CLOUDINARY_URL');
    if (cloudinaryUrl) {
      cloudinary.config({
        secure: true,
      });
      this.isCloudinaryConfigured = true;
    }
  }

  async uploadPhotoToCloudinary(file: Express.Multer.File): Promise<string> {
    if (!this.isCloudinaryConfigured) {
      // Fallback: If no Cloudinary URL is provided, return a placeholder or local mock
      // This ensures the app doesn't crash if the user hasn't setup Cloudinary yet.
      return `/uploads/mock_${Date.now()}_${file.originalname}`;
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'rsmts-assets' },
        (error, result) => {
          if (error) return reject(error);
          resolve((result as any)?.secure_url);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async attachPhotosToLatestLog(
    assetNumber: string,
    handledBy: string,
    fileUrls: string[],
  ) {
    if (fileUrls.length === 0) return;

    const latestLog = await this.prisma.movementLog.findFirst({
      where: {
        asset_number: assetNumber,
        handled_by: handledBy,
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!latestLog) {
      throw new InternalServerErrorException(
        `No recent movement log found for asset ${assetNumber} to attach photos.`,
      );
    }

    await this.prisma.assetPhoto.createMany({
      data: fileUrls.map((url) => ({
        photo_url: url,
        asset_number: assetNumber,
        movement_log_id: latestLog.log_id,
      })),
    });

    return { success: true, count: fileUrls.length, log_id: latestLog.log_id };
  }
}

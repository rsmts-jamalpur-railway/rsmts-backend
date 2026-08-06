import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Body,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('sync/photos')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload asset photos dynamically to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        asset_number: { type: 'string' },
        photos: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('photos', 10)) // Max 10 photos
  async uploadPhotos(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('asset_number') assetNumber: string,
    @Request() req: any,
  ) {
    if (!assetNumber) {
      throw new BadRequestException('asset_number is required');
    }

    if (!files || files.length === 0) {
      return { success: true, message: 'No files provided.' };
    }

    const uploadedUrls: string[] = [];

    // Upload sequentially to Cloudinary (or fallback)
    for (const file of files) {
      const url = await this.uploadService.uploadPhotoToCloudinary(file);
      uploadedUrls.push(url);
    }

    // Attach to the database
    const result = await this.uploadService.attachPhotosToLatestLog(
      assetNumber,
      req.user.userId,
      uploadedUrls,
    );

    return {
      success: true,
      message: 'Photos uploaded successfully',
      count: uploadedUrls.length,
      log_id: result?.log_id,
    };
  }
}

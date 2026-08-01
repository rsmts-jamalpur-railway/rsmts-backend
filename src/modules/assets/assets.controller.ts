import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { GetAssetsQueryDto } from './dto/get-assets-query.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { RolesGuard, Roles } from '../../auth/roles.guard';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Roles('Administrator', 'Management', 'SSE', 'Yard_Master')
  @Post()
  @ApiOperation({ summary: 'Register a new asset (Validates 11-digit number)' })
  create(@Body() createAssetDto: CreateAssetDto, @Request() req) {
    return this.assetsService.create(createAssetDto, req.user.userId);
  }

  @Roles(
    'Administrator',
    'Management',
    'SSE',
    'WRS_5_Inspector',
    'Shop_InCharge',
    'Yard_Master',
  )
  @Get()
  @ApiOperation({ summary: 'Search and list assets' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'location', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query() query: GetAssetsQueryDto) {
    return this.assetsService.findAll(query);
  }

  @Roles(
    'Administrator',
    'Management',
    'SSE',
    'WRS_5_Inspector',
    'Shop_InCharge',
    'Yard_Master',
  )
  @Get(':asset_number')
  @ApiOperation({ summary: 'Get asset details including movement history' })
  findOne(@Param('asset_number') asset_number: string) {
    return this.assetsService.findOne(asset_number);
  }

  @Roles('Administrator', 'Management', 'SSE')
  @Patch(':asset_number')
  @ApiOperation({ summary: 'Update asset details' })
  update(
    @Param('asset_number') asset_number: string,
    @Body() updateAssetDto: UpdateAssetDto,
    @Request() req,
  ) {
    return this.assetsService.update(
      asset_number,
      updateAssetDto,
      req.user.userId,
    );
  }

  @Roles('Administrator', 'Management')
  @Delete(':asset_number')
  @ApiOperation({ summary: 'Soft delete an asset' })
  remove(@Param('asset_number') asset_number: string, @Request() req) {
    return this.assetsService.remove(asset_number, req.user.userId);
  }
}

import { Global, Module } from '@nestjs/common';
import { WagonValidationService } from './wagon-validation.service';

@Global()
@Module({
  providers: [WagonValidationService],
  exports: [WagonValidationService],
})
export class WagonValidationModule {}

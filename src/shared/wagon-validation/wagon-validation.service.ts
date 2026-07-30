import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class WagonValidationService {
  /**
   * Validates an 11-digit wagon number using the standard Check Digit algorithm.
   */
  validateNumber(wagonNo: string): boolean {
    if (!wagonNo || wagonNo.length !== 11 || !/^\d+$/.test(wagonNo)) {
      throw new BadRequestException('Wagon number must be exactly 11 digits');
    }

    const c1 = parseInt(wagonNo[0], 10);
    const c2 = parseInt(wagonNo[1], 10);
    const c3 = parseInt(wagonNo[2], 10);
    const c4 = parseInt(wagonNo[3], 10);
    const c5 = parseInt(wagonNo[4], 10);
    const c6 = parseInt(wagonNo[5], 10);
    const c7 = parseInt(wagonNo[6], 10);
    const c8 = parseInt(wagonNo[7], 10);
    const c9 = parseInt(wagonNo[8], 10);
    const c10 = parseInt(wagonNo[9], 10);
    const providedCheckDigit = parseInt(wagonNo[10], 10);

    // Step 1: Add all digits at EVEN positions (0-indexed array, so indices 1, 3, 5, 7, 9 - wait, Standard is 1-indexed: 2nd, 4th, 6th, 8th, 10th positions)
    const s1 = c2 + c4 + c6 + c8 + c10;

    // Step 2: Multiply sum by 3
    const s2 = s1 * 3;

    // Step 3: Add all digits at ODD positions (1st, 3rd, 5th, 7th, 9th)
    const s3 = c1 + c3 + c5 + c7 + c9;

    // Step 4: Add results of Step 2 and Step 3
    const s4 = s2 + s3;

    // Step 5: Find the next multiple of 10
    const nextMultipleOf10 = Math.ceil(s4 / 10) * 10;

    // Step 6: Calculate check digit
    let calculatedCheckDigit = nextMultipleOf10 - s4;

    // If next multiple is same as s4 (e.g. s4 is 60), check digit is 0
    if (calculatedCheckDigit === 10) {
      calculatedCheckDigit = 0;
    }

    return calculatedCheckDigit === providedCheckDigit;
  }

  parseNumber(wagonNo: string) {
    if (!this.validateNumber(wagonNo)) {
      throw new BadRequestException('Invalid wagon check digit');
    }

    return {
      type: wagonNo.substring(0, 2),
      railway: wagonNo.substring(2, 4),
      year: wagonNo.substring(4, 6),
      serial: wagonNo.substring(6, 10),
      checkDigit: wagonNo[10],
    };
  }
}

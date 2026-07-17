import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ImportsService } from './imports.service';

const vehicleTemplate = [
  'S/N',
  'LOCATION/USER',
  'VEHICLE TYPE/MAKE',
  'PRIVATE REG. NUMBER',
  'OFFICIAL REG. NUMBER',
  'PURCHASE COST',
  'BOOKED VALUE (N)',
  'ESTIMATED COST (N)',
  'RESERVED PRESENT VALUE',
  'AGE',
  'YEAR OF PURCHASE',
  'SERVICEABLE/UNSERVICEABLE',
  'LEGACY AGENCY',
  'CHASSIS NUMBER',
  'ENGINE NUMBER',
  'STATUS',
  'REMARK',
  'DESCRIPTION OF FAULT',
].join(',');

const vehicleExample = [
  '1',
  'LAG-HQ',
  'Toyota Hilux',
  'ABC-123XY',
  'FGN-001A',
  '35000000',
  '22000000',
  '30000000',
  '18000000',
  '3',
  '2023',
  'SERVICEABLE',
  'NMDPRA',
  'CHS-001',
  'ENG-001',
  'AVAILABLE',
  'Operational',
  '',
].join(',');

const templates = {
  locations:
    'code,name,address,state,description,status,sortOrder\nLAG-HQ,Lagos Headquarters,1 Example Road,Lagos,Main office,ACTIVE,0\n',
  vehicles: `${vehicleTemplate}\n${vehicleExample}\n`,
  drivers:
    "S/N,DRIVER'S NAME,LOCATION,ZONE,CATEGORY,I D NUMBER,E MAIL,PHONE NUMBER\n1,Jane Driver,Lagos,South West,PERMANENT STAFF,EMP-001,jane@example.com,08000000000\n",
};

@Controller('imports')
export class ImportsController {
  constructor(private imports: ImportsService) {}
  @Post('locations')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  locations(@UploadedFile() f: Express.Multer.File) {
    return this.imports.locations(f);
  }
  @Post('vehicles')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  vehicles(@UploadedFile() f: Express.Multer.File) {
    return this.imports.vehicles(f);
  }
  @Post('drivers')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  drivers(@UploadedFile() f: Express.Multer.File) {
    return this.imports.drivers(f);
  }
  @Get(':type/template')
  template(@Param('type') type: keyof typeof templates, @Res() res: Response) {
    const csv = templates[type];
    if (!csv) return res.status(404).json({ message: 'Template not found.' });
    res.type('text/csv').attachment(`${type}-import-template.csv`).send(csv);
  }
}

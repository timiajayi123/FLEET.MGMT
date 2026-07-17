import { Body, Controller, Delete, Get, Param, ParseFilePipeBuilder, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SaveUserDto, UsersQueryDto } from './users.dto';
import { UsersService } from './users.service';
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() list(@Query() query: UsersQueryDto) { return this.users.list(query); }
  @Post() async create(@Body() dto: SaveUserDto) { return { data: await this.users.create(dto) }; }
  @Patch(':id') async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveUserDto) { return { data: await this.users.update(id, dto) }; }
  @Delete(':id') async deactivate(@Param('id', ParseUUIDPipe) id: string) { return { data: await this.users.deactivate(id) }; }
  @Post(':id/passport') @UseInterceptors(FileInterceptor('passport',{limits:{fileSize:3*1024*1024}}))
  async uploadPassport(@Param('id',ParseUUIDPipe) id:string,@UploadedFile(new ParseFilePipeBuilder().addMaxSizeValidator({maxSize:3*1024*1024}).build({fileIsRequired:true})) file:Express.Multer.File){return {data:await this.users.savePassport(id,file)}}
  @Get(':id/passport') async passport(@Param('id',ParseUUIDPipe) id:string,@Res() res:Response){const image=await this.users.passport(id);res.type(image.passportMimeType!).set('Cache-Control','private, max-age=300').send(Buffer.from(image.passportData!))}
}

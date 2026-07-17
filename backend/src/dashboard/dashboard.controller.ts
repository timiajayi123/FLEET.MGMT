import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
@Controller('dashboard')
export class DashboardController { constructor(private readonly dashboard:DashboardService){} @Get() get(@Query('days') days?:string){const value=days==='90'?90:30;return this.dashboard.summary(value)} }

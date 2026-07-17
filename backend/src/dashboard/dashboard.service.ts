import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async summary(days = 30) {
    const since = new Date(); since.setUTCHours(0,0,0,0); since.setUTCDate(since.getUTCDate()-(days-1));
    const [totalRequests,pendingRequests,approvedRequests,activeUsers,recent,queue] = await Promise.all([
      this.prisma.vehicleRequest.count(), this.prisma.vehicleRequest.count({where:{status:'PENDING_APPROVAL'}}),
      this.prisma.vehicleRequest.count({where:{status:'APPROVED'}}), this.prisma.user.count({where:{status:'ACTIVE'}}),
      this.prisma.vehicleRequest.findMany({where:{createdAt:{gte:since}},select:{createdAt:true}}),
      this.prisma.vehicleRequest.findMany({where:{status:'PENDING_APPROVAL'},orderBy:{createdAt:'desc'},take:5,select:{id:true,requestNumber:true,staffName:true,destination:true,createdAt:true}}),
    ]);
    const counts=new Map<string,number>(); for(let i=0;i<days;i++){const d=new Date(since);d.setUTCDate(since.getUTCDate()+i);counts.set(d.toISOString().slice(0,10),0)}
    recent.forEach(r=>{const key=r.createdAt.toISOString().slice(0,10);counts.set(key,(counts.get(key)??0)+1)});
    return { metrics:{totalRequests,pendingRequests,approvedRequests,activeUsers}, activity:[...counts].map(([date,count])=>({date,count})), approvalQueue:queue,
      notifications: queue.map(item=>({id:item.id,title:'Vehicle request awaiting approval',message:`${item.requestNumber} · ${item.staffName} · ${item.destination}`,createdAt:item.createdAt})) };
  }
}

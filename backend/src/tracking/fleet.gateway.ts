import { Injectable } from '@nestjs/common';
import { ConnectedSocket, OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';

const socketAllowedOrigins =
  process.env.FRONTEND_URL?.split(',').map((origin) => origin.trim()).filter(Boolean) ??
  (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3001']);

@Injectable()
@WebSocketGateway({
  path: '/socket.io',
  cors: {
    origin(origin, callback) {
      if (!origin || socketAllowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by Socket.IO CORS.'));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class FleetGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(private readonly auth: AuthService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    const cookie = client.handshake.headers.cookie;
    const token = cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const user = await this.auth.fromToken(token);
    if (!user || !['S_ADMIN', 'FM'].includes(user.role.code)) {
      client.disconnect(true);
      return;
    }
    await client.join('fleet-tracking');
  }

  publishLocation(location: Record<string, unknown>) {
    this.server?.to('fleet-tracking').emit('vehicle-location', location);
  }
}

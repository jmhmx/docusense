// backend/src/websocket/websocket.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private userSockets = new Map<string, string[]>();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub;

      client.data.userId = userId;

      // Agregar a mapa de usuarios conectados
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId).push(client.id);

      this.logger.log(`Usuario ${userId} conectado con socketId ${client.id}`);

      // Unir al usuario a su sala privada
      client.join(`user-${userId}`);
    } catch (error) {
      this.logger.error(`Error en conexión WebSocket: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      // Eliminar de la lista de conexiones
      const userConnections = this.userSockets.get(userId) || [];
      const updatedConnections = userConnections.filter(
        (id) => id !== client.id,
      );

      if (updatedConnections.length === 0) {
        this.userSockets.delete(userId);
      } else {
        this.userSockets.set(userId, updatedConnections);
      }

      this.logger.log(`Usuario ${userId} desconectado`);
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { topic: string }) {
    const { topic } = payload;
    client.join(topic);
    this.logger.log(`Cliente ${client.id} suscrito a ${topic}`);
    return { success: true, topic };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { topic: string }) {
    const { topic } = payload;
    client.leave(topic);
    this.logger.log(`Cliente ${client.id} desuscrito de ${topic}`);
    return { success: true, topic };
  }

  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user-${userId}`).emit('notification', notification);
    this.logger.log(`Notificación enviada a usuario ${userId}`);
  }

  sendNotificationToTopic(topic: string, notification: any) {
    this.server.to(topic).emit('notification', notification);
    this.logger.log(`Notificación enviada a topic ${topic}`);
  }

  sendNotificationToAll(notification: any) {
    this.server.emit('notification', notification);
    this.logger.log('Notificación enviada a todos los usuarios');
  }
}

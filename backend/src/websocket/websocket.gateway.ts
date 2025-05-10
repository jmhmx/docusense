import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebsocketGateway.name);
  private userSockets: Map<string, Socket[]> = new Map();

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Verificar token de autenticación
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn('Conexión sin token rechazada');
        client.disconnect();
        return;
      }

      // Validar token
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Asignar usuario al socket
      client.data.userId = userId;

      // Registrar socket para el usuario
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId).push(client);

      // Suscribir al usuario a su room personal
      client.join(userId);

      this.logger.log(`Cliente conectado: ${userId}`);
    } catch (error) {
      this.logger.error(`Error en conexión de socket: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      // Eliminar socket de la lista de sockets del usuario
      const userSocketList = this.userSockets.get(userId);
      if (userSocketList) {
        const index = userSocketList.indexOf(client);
        if (index !== -1) {
          userSocketList.splice(index, 1);
        }

        // Si no quedan sockets para este usuario, eliminar la entrada
        if (userSocketList.length === 0) {
          this.userSockets.delete(userId);
        }
      }

      this.logger.log(`Cliente desconectado: ${userId}`);
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, payload: { topic: string }) {
    client.join(payload.topic);
    this.logger.log(
      `Usuario ${client.data.userId} suscrito a ${payload.topic}`,
    );
    return { success: true };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, payload: { topic: string }) {
    client.leave(payload.topic);
    this.logger.log(
      `Usuario ${client.data.userId} desuscrito de ${payload.topic}`,
    );
    return { success: true };
  }

  // Método para enviar notificación a un usuario específico
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(userId).emit(event, data);
  }

  // Método para enviar notificación a todos los suscriptores de un tema
  sendToTopic(topic: string, event: string, data: any) {
    this.server.to(topic).emit(event, data);
  }

  sendNotificationToUser(userId: string, data: any) {
    this.server.to(userId).emit('notification', data);
  }
}

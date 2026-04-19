import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from '../message/message.service';
import { IdentityService } from '../identity/identity.service';
import { ChatSettingsService } from '../chat/chat-settings.service';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, string>();
  private identityToSocket = new Map<string, string>();

  constructor(
    private messageService: MessageService,
    private identityService: IdentityService,
    private chatSettingsService: ChatSettingsService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`✅ WebSocket подключен: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = Array.from(this.userSockets.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    
    const identityId = Array.from(this.identityToSocket.entries())
      .find(([_, socketId]) => socketId === client.id)?.[0];
    
    if (userId) this.userSockets.delete(userId);
    
    if (identityId) {
      this.identityToSocket.delete(identityId);
      await this.identityService.setOffline(identityId);
      this.server.emit('user_status', { identity_id: identityId, is_online: false });
    }
    
    console.log(`❌ WebSocket отключен: ${client.id}`);
  }

  @SubscribeMessage('register')
  async handleRegister(@MessageBody() data: { user_id: string; identity_id: string }, @ConnectedSocket() client: Socket) {
    this.userSockets.set(data.user_id, client.id);
    client.join(`user:${data.user_id}`);
    
    if (data.identity_id) {
      this.identityToSocket.set(data.identity_id, client.id);
      client.join(`identity:${data.identity_id}`);
      await this.identityService.setOnline(data.identity_id);
      this.server.emit('user_status', { identity_id: data.identity_id, is_online: true });
    }
  }

  @SubscribeMessage('join_chat')
  handleJoinChat(@MessageBody() data: { chat_id: string }, @ConnectedSocket() client: Socket) {
    client.join(`chat:${data.chat_id}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(@MessageBody() data: any) {
    // Check if sender is blocked by recipient
    const chat = await this.messageService.getChat(data.chat_id);
    if (chat) {
      for (const participantId of chat.participants) {
        const participantIdStr = participantId.toString();
        if (participantIdStr !== data.sender_identity_id) {
          // Check if this participant has blocked the sender
          const isBlocked = await this.identityService.isBlocked(participantIdStr, data.sender_identity_id);
          if (isBlocked) {
            console.log(`🚫 Message blocked: ${data.sender_identity_id} is blocked by ${participantIdStr}`);
            // Send blocked notification to sender
            this.server.to(`identity:${data.sender_identity_id}`).emit('message_blocked', {
              reason: 'blocked_by_recipient',
              message: 'You are blocked by this user'
            });
            return { error: 'blocked' };
          }
        }
      }
    }

    const message = await this.messageService.createMessage(
      data.chat_id,
      data.sender_identity_id,
      data.encrypted_content,
      data.type,
    );

    console.log(`💬 Сообщение отправлено в чат ${data.chat_id}`);
    
    // Отправляем сообщение всем в чате
    this.server.to(`chat:${data.chat_id}`).emit('receive_message', message);
    
    // Увеличиваем счетчик непрочитанных для других участников
    if (chat) {
      for (const participantId of chat.participants) {
        const participantIdStr = participantId.toString();
        if (participantIdStr !== data.sender_identity_id) {
          await this.chatSettingsService.incrementUnread(data.chat_id, participantIdStr);
          
          // Отправляем обновление счетчика
          this.server.to(`identity:${participantIdStr}`).emit('unread_update', {
            chat_id: data.chat_id,
            unread_count: (await this.chatSettingsService.getSettings(data.chat_id, participantIdStr)).unread_count,
          });
        }
      }
    }
    
    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() data: { chat_id: string; identity_id: string }) {
    this.server.to(`chat:${data.chat_id}`).emit('typing', data);
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(@MessageBody() data: { chat_id: string; identity_id: string }) {
    await this.chatSettingsService.markAsRead(data.chat_id, data.identity_id);
    
    // Уведомляем пользователя об обновлении
    this.server.to(`identity:${data.identity_id}`).emit('unread_update', {
      chat_id: data.chat_id,
      unread_count: 0,
    });
  }

  @SubscribeMessage('toggle_pin')
  async handleTogglePin(@MessageBody() data: { chat_id: string; identity_id: string }) {
    const settings = await this.chatSettingsService.togglePin(data.chat_id, data.identity_id);
    
    this.server.to(`identity:${data.identity_id}`).emit('pin_update', {
      chat_id: data.chat_id,
      is_pinned: settings.is_pinned,
    });
    
    return { is_pinned: settings.is_pinned };
  }

  @SubscribeMessage('toggle_mute')
  async handleToggleMute(@MessageBody() data: { chat_id: string; identity_id: string }) {
    const settings = await this.chatSettingsService.toggleMute(data.chat_id, data.identity_id);
    
    this.server.to(`identity:${data.identity_id}`).emit('mute_update', {
      chat_id: data.chat_id,
      is_muted: settings.is_muted,
    });
    
    return { is_muted: settings.is_muted };
  }

  notifyIdentityUpdate(user_id: string, newIdentity: any) {
    this.server.to(`user:${user_id}`).emit('identity_updated', newIdentity);
  }
}

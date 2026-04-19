# Jemmy Server

Анонимный мессенджер с Ephemeral Identity

## Быстрый старт

```bash
npm install
npm run start:dev
```

## Что внутри

**Модули:**
- `auth` - анонимная регистрация по device_id
- `identity` - управление личностями + автоматическая ротация
- `chat` - создание чатов (1-1 и группы)
- `message` - отправка сообщений
- `websocket` - real-time события

**MongoDB схемы:**
- User (device_id, ephemeral_enabled)
- Identity (username, avatar_seed, expires_at)
- Chat (participants, is_group)
- Message (encrypted_content)

**WebSocket события:**
- `register` - регистрация пользователя
- `join_chat` - подключение к чату
- `send_message` - отправка сообщения
- `receive_message` - получение сообщения
- `typing` - индикатор печати
- `identity_updated` - уведомление о смене личности

**CRON:**
Каждые 10 минут проверяет истекшие личности и автоматически их обновляет.

## API Endpoints

```
POST /auth/register
POST /auth/toggle-ephemeral
POST /chat/create
GET  /chat/user/:identity_id
POST /identity/toggle-ephemeral
GET  /identity/user/:user_id
```

## Переменные окружения

Создай `.env` файл (пример в `.env.example`):
```
PORT=3000
MONGODB_URI=mongodb+srv://...
IDENTITY_ROTATION_INTERVAL_HOURS=24
```

# 🔄 Перезапуск сервера с новыми роутами

## ✅ Что было добавлено в server.js

### Схема Identity обновлена:
```javascript
privacy_settings: {
  who_can_message: 'everyone',
  who_can_see_profile: 'everyone',
  who_can_see_online: 'everyone',
  who_can_see_last_seen: 'everyone',
  auto_delete_messages: 0
},
blocked_users: [ObjectId]
```

### Новые роуты:
1. `PATCH /api/identity/privacy/update` - Обновить настройки приватности
2. `GET /api/identity/privacy/:identity_id` - Получить настройки
3. `POST /api/identity/block` - Заблокировать пользователя
4. `POST /api/identity/unblock` - Разблокировать
5. `GET /api/identity/blocked-list/:identity_id` - Список заблокированных
6. `GET /api/identity/can-message/:from_id/:to_id` - Проверка прав
7. `GET /api/identity/can-see-profile/:viewer_id/:target_id` - Проверка видимости

## 🚀 Как перезапустить

### Локально:
```bash
cd JEMMY-SERVER

# Остановить текущий процесс (Ctrl+C)

# Запустить заново
npm start
# или
npm run dev
```

### На сервере (если используется PM2):
```bash
pm2 restart jemmy-server
# или
pm2 restart all
```

### На Vercel:
```bash
# Просто сделайте git push
git add .
git commit -m "Add privacy routes"
git push

# Vercel автоматически задеплоит
```

## 🧪 Тестирование

### 1. Проверка здоровья сервера:
```bash
curl http://localhost:25593/api
# Должен вернуть: {"status":"ok","mongodb":"connected",...}
```

### 2. Получить настройки приватности:
```bash
curl http://localhost:25593/api/identity/privacy/YOUR_IDENTITY_ID
# Должен вернуть: {"privacy_settings":{...}}
```

### 3. Обновить настройки:
```bash
curl -X PATCH http://localhost:25593/api/identity/privacy/update \
  -H "Content-Type: application/json" \
  -d '{
    "identity_id": "YOUR_IDENTITY_ID",
    "settings": {
      "who_can_message": "nobody"
    }
  }'
```

### 4. Заблокировать пользователя:
```bash
curl -X POST http://localhost:25593/api/identity/block \
  -H "Content-Type: application/json" \
  -d '{
    "blocker_identity_id": "YOUR_ID",
    "blocked_identity_id": "OTHER_ID"
  }'
```

## 📊 Логи

После перезапуска вы должны увидеть:
```
🚀 Jemmy Server запущен!
📡 HTTP: http://0.0.0.0:25593
🔌 WebSocket: ws://178.104.40.37:25594
✅ MongoDB подключена успешно!
```

При запросе к новым роутам:
```
📡 GET /api/identity/privacy/69d14c586d7892b5fc98c978
📦 Identity ID: 69d14c586d7892b5fc98c978
✅ Privacy settings loaded
```

## ⚠️ Важно

1. Убедитесь что MongoDB подключена
2. Проверьте что .env файл настроен правильно
3. Старые identity документы получат дефолтные настройки автоматически
4. Блокировка хранится в массиве blocked_users в документе Identity

## 🔍 Отладка

Если роуты не работают:

1. Проверьте что сервер перезапущен
2. Проверьте логи: `npm start` покажет все запросы
3. Проверьте что используется правильный порт (25593)
4. Проверьте что MongoDB подключена

Если получаете HTML вместо JSON:
- Значит роут не найден
- Проверьте URL: должен быть `/api/identity/privacy/...`
- Проверьте что сервер перезапущен после изменений

# 🐛 Отладка проблемы с ID

## Проблема
```
Identity ID: 69d14c586d7892b5fc98c978
❌ Identity not found
```

## Причина
ID `69d14c586d7892b5fc98c978` имеет **24 символа** - это правильная длина для MongoDB ObjectId.
Но identity не находится в базе.

## Возможные причины:

### 1. База данных была очищена
Проверьте:
```bash
# Подключитесь к MongoDB
mongosh "YOUR_MONGODB_URI"

# Переключитесь на базу jemmy
use jemmy

# Посмотрите все identities
db.identities.find().pretty()

# Посмотрите конкретный ID
db.identities.findOne({_id: ObjectId("69d14c586d7892b5fc98c978")})
```

### 2. Приложение использует старый ID из кэша
iOS приложение могло сохранить старый ID в UserDefaults.

**Решение:**
1. Удалите приложение с устройства/симулятора
2. Переустановите
3. Зарегистрируйтесь заново

### 3. Сервер перезапустился и создал новую базу
Проверьте логи сервера при запуске:
```
✅ MongoDB подключена успешно!
📁 Database: jemmy
```

## 🔧 Быстрое решение

### Вариант 1: Очистить данные приложения (iOS)
```swift
// В iOS приложении добавьте кнопку для очистки:
UserDefaults.standard.removeObject(forKey: "device_id")
UserDefaults.standard.removeObject(forKey: "user_id")
UserDefaults.standard.removeObject(forKey: "identity_id")
// Перезапустите приложение
```

### Вариант 2: Посмотреть реальные ID в базе
Перезапустите сервер с обновленным кодом - он покажет:
```
🔍 Searching all identities...
📋 Sample identities: [
  { id: '67a1b2c3d4e5f6g7h8i9j0k1', username: 'SilentWolf1234' },
  { id: '67a1b2c3d4e5f6g7h8i9j0k2', username: 'GhostRaven5678' }
]
```

Используйте один из этих ID для тестирования.

### Вариант 3: Зарегистрироваться заново
```bash
# Отправьте новый запрос регистрации
curl -X POST http://localhost:25593/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "test-device-123",
    "public_key": "test-key"
  }'

# Ответ покажет новый identity_id:
{
  "user_id": "...",
  "identity": {
    "_id": "NEW_VALID_ID",
    "username": "...",
    ...
  }
}
```

## 🧪 Тестирование

После получения правильного ID:

```bash
# 1. Проверьте что identity существует
curl http://localhost:25593/api/identity/CORRECT_ID

# 2. Обновите настройки приватности
curl -X PATCH http://localhost:25593/api/identity/privacy/update \
  -H "Content-Type: application/json" \
  -d '{
    "identity_id": "CORRECT_ID",
    "settings": {
      "who_can_message": "nobody"
    }
  }'

# 3. Получите настройки
curl http://localhost:25593/api/identity/privacy/CORRECT_ID
```

## 📊 Проверка базы данных

```javascript
// В MongoDB shell
use jemmy

// Посмотреть все identities
db.identities.find({}, {_id: 1, username: 1, is_active: 1})

// Посмотреть все users
db.users.find({}, {_id: 1, device_id: 1, current_identity_id: 1})

// Найти identity по username
db.identities.findOne({username: "ADMI"})
```

## ⚠️ Важно

Если вы видите в логах:
```
🔍 Searching all identities...
📋 Sample identities: []
```

Значит база данных пустая! Нужно зарегистрироваться заново.

## 🔄 Полный сброс (если ничего не помогает)

```bash
# 1. Остановите сервер (Ctrl+C)

# 2. Очистите базу данных (ОСТОРОЖНО!)
mongosh "YOUR_MONGODB_URI"
use jemmy
db.dropDatabase()
exit

# 3. Перезапустите сервер
npm start

# 4. Удалите и переустановите iOS приложение

# 5. Зарегистрируйтесь заново
```

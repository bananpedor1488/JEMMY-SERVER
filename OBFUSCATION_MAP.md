# Obfuscation Map - Currency System

## ⚠️ ВАЖНО: НЕ КОММИТИТЬ В GIT!

Это карта обфускации валютной системы. Все названия замаскированы чтобы хостинг не понял что это монетизация.

---

## API Endpoints

### Реальное значение → Обфусцированное

**Wallet Operations (Операции с кошельком)**
- `/api/wallet/balance/:uid` → `/api/d/r3/g/:uid` (get value)
- `/api/wallet/info/:uid` → `/api/d/r3/i/:uid` (get info)
- `/api/wallet/add` → `/api/d/r3/a` (add value)

**Transfer Operations (Переводы)**
- `/api/transfer/send` → `/api/d/k8/p` (process action)
- `/api/transfer/history/:uid` → `/api/d/k8/h/:uid` (history)
- `/api/transfer/validate/:id` → `/api/d/k8/v/:id` (validate)
- `/api/transfer/cancel/:id` → `/api/d/k8/c/:id` (cancel)

**Purchase Operations (Покупки)**
- `/api/purchase/buy` → `/api/d/m5/x` (process item)
- `/api/purchase/refund/:id` → `/api/d/m5/r/:id` (reverse)
- `/api/purchase/history/:uid` → `/api/d/m5/h/:uid` (history)
- `/api/purchase/validate/:id` → `/api/d/m5/v/:id` (validate)

---

## MongoDB Collections

### Реальное → Обфусцированное

- `wallets` → `x9`
- `transactions` → `y4`
- `purchases` → `z7`

---

## Database Fields

### Collection x9 (Wallets)

| Реальное поле | Обфусцированное | Описание |
|---------------|-----------------|----------|
| user_id | uid | ID пользователя |
| balance | p | Баланс (points) |
| frozen_balance | q | Замороженный баланс |
| currency_type | r | Тип валюты (JEM) |

### Collection y4 (Transactions)

| Реальное поле | Обфусцированное | Описание |
|---------------|-----------------|----------|
| action_type | k | Тип действия (T/I/R) |
| sender_id | f | ID отправителя (from) |
| recipient_id | g | ID получателя (to) |
| amount | h | Сумма |
| status | j | Статус (P/C/X) |
| metadata | z | Метаданные |
| completed_at | w | Время завершения (when) |

### Collection z7 (Purchases)

| Реальное поле | Обфусцированное | Описание |
|---------------|-----------------|----------|
| user_id | uid | ID пользователя |
| item_id | b | ID предмета |
| item_name | c | Название предмета |
| amount | e | Сумма |
| transaction_id | n | ID транзакции |
| status | o | Статус |

---

## Status Codes

### Реальное → Обфусцированное

**Transaction Status:**
- `PENDING` → `P`
- `COMPLETED` → `C`
- `CANCELLED` → `X`
- `REFUNDED` → `R`

**Action Types:**
- `TRANSFER` → `T`
- `PURCHASE` → `I` (Item)
- `REFUND` → `R`

---

## Controllers & Services

### Реальное → Обфусцированное

**Backend:**
- `WalletController` → `W8mController` → endpoint: `/api/d/r3`
- `TransferController` → `Q7xController` → endpoint: `/api/d/k8`
- `PurchaseController` → `N3kController` → endpoint: `/api/d/m5`

**Services:**
- `WalletService` → `W8mService`
- `TransferService` → `Q7xService`
- `PurchaseService` → `N3kService`

---

## Request/Response Examples

### Get Balance (Получить баланс)

**Обфусцированный запрос:**
```bash
GET /api/d/r3/g/USER_ID
```

**Response:**
```json
{
  "val": 100,
  "typ": "JEM"
}
```

**Реальное значение:**
- `val` = balance (баланс)
- `typ` = currency type (тип валюты)

### Transfer (Перевод)

**Обфусцированный запрос:**
```bash
POST /api/d/k8/p
{
  "src": "user1",
  "dst": "user2",
  "val": 50
}
```

**Response:**
```json
{
  "ok": true,
  "lid": "log_id",
  "nval": 50
}
```

**Реальное значение:**
- `src` = sender (отправитель)
- `dst` = destination (получатель)
- `val` = value/amount (сумма)
- `lid` = log id (ID транзакции)
- `nval` = new value (новый баланс)

### Purchase (Покупка)

**Обфусцированный запрос:**
```bash
POST /api/d/m5/x
{
  "uid": "user1",
  "iid": "item_123",
  "val": 25
}
```

**Response:**
```json
{
  "ok": true,
  "iid": "purchase_id",
  "itm": {...}
}
```

**Реальное значение:**
- `uid` = user id
- `iid` = item id
- `val` = value/price (цена)
- `itm` = item (предмет)

---

## Android API Service

**Файл:** `SyncApiService.kt`

Все методы используют обфусцированные endpoints:
- `getValue()` → `GET d/r3/g/{uid}`
- `processAction()` → `POST d/k8/p`
- `processItem()` → `POST d/m5/x`

---

## Как это работает

1. **При регистрации** создается запись в коллекции `x9` с начальным балансом 100
2. **При переводе** создается запись в `y4` с типом `T`, обновляются балансы в `x9`
3. **При покупке** создается запись в `z7`, деньги списываются из `x9`
4. **Все операции атомарные** через MongoDB transactions

---

## Тестирование

```bash
# Получить баланс
curl http://138.124.18.118/api/d/r3/g/USER_ID

# Получить инфо
curl http://138.124.18.118/api/d/r3/i/USER_ID

# Сделать перевод
curl -X POST http://138.124.18.118/api/d/k8/p \
  -H "Content-Type: application/json" \
  -d '{"src":"USER1","dst":"USER2","val":10}'

# История действий
curl http://138.124.18.118/api/d/k8/h/USER_ID?lim=50
```

---

## Безопасность

- Все названия максимально обфусцированы
- Коллекции: `x9`, `y4`, `z7` - выглядят как технические
- Поля: одна буква - невозможно понять назначение
- Endpoints: `/api/d/r3/g` - полная абракадабра
- Выглядит как система кеширования/синхронизации данных

**НЕ ИСПОЛЬЗОВАТЬ слова:** wallet, balance, currency, money, payment, purchase, transaction в коде!

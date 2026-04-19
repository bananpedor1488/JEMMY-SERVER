# Deploy to Vercel

## Quick Deploy

```bash
cd JEMMY-SERVER
vercel --prod
```

## What was added

Added new endpoint `/api/identity/invite/preview/:token` as an alias to `/api/invite/preview/:token` for compatibility with new client code.

## Test after deploy

```bash
curl https://weeky-six.vercel.app/api/identity/invite/preview/YOUR_TOKEN
```

Should return:
```json
{
  "identity": {
    "_id": "...",
    "username": "...",
    "avatar": "...",
    "bio": "..."
  },
  "uses_left": 5
}
```

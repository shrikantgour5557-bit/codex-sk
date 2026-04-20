# FreeAdSpace API Contract (v1)

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`

## Ads
- `GET /api/ads?search=&category=&featured=`
- `GET /api/ads/:id`
- `POST /api/ads` (auth)
- `PATCH /api/ads/:id` (auth + owner)
- `DELETE /api/ads/:id` (auth + owner/admin)

## Admin
- `GET /api/admin/dashboard` (admin)
- `POST /api/admin/ads/:id/moderate` (admin)
- `POST /api/admin/users/:userId/block` (admin)

## Suggested response envelope

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {}
}
```

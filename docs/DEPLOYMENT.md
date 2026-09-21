# Later deployment

No cloud app has been deployed as part of this development pass.

Use Render for the Fastify API. `render.yaml` is a blueprint, not a deployment. Render's free web service can sleep after inactivity; the client allows a longer cold-start timeout. Free Render PostgreSQL expires after 30 days, so use a separate durable PostgreSQL provider for a lasting preview and review that provider's current free-plan limits before choosing it.

Required API environment:

- `NODE_ENV=production`
- `DATABASE_URL`: external PostgreSQL connection string with TLS as required by the provider
- `JWT_SECRET`: random secret of at least 32 characters
- `CORS_ORIGIN`: comma-separated allowed browser origins
- Optional `RESEND_API_KEY` and `EMAIL_FROM` for recovery email
- Optional `GOOGLE_CLIENT_IDS` for the Google token verification API

The server applies its additive schema at startup. Local PGlite is intentionally rejected in production because Render's local filesystem is ephemeral. No Redis, vision worker, cloud image storage, or server-side AI is required.

Build the phone app with `EXPO_PUBLIC_API_URL` set to the deployed HTTPS API URL. The web preview can be hosted as static SPA assets from `mobile/dist` with all routes falling back to `index.html`.

Native distribution requires signing. Apple App Store / Google Play costs are separate from free server hosting. LFM model distribution and licensing must be reviewed for the intended release scale.

Sources: https://render.com/docs/free ; https://developer.android.com/health-and-fitness/health-connect ; https://developer.apple.com/documentation/healthkit

# GitHub Migration Checklist

Use this checklist when moving this repository from GitLab to GitHub.

## Repository

1. Create or confirm the empty GitHub repository at `git@github.com:mfrankhuizen93/PawPaths.git`.
2. Push every local branch and tag:

   ```bash
   git remote rename origin gitlab
   git remote add origin git@github.com:mfrankhuizen93/PawPaths.git
   git push origin --all
   git push origin --tags
   ```

3. Confirm the default branch on GitHub is `main`.
4. Keep the old `gitlab` remote temporarily until GitHub, Vercel, and access permissions are verified.

## GitHub

1. Enable branch protection for `main`.
2. Require the `CI / Test and build` check before merging.
3. Enable Dependabot alerts and secret scanning in repository settings.
4. Confirm CodeQL alerts appear under the repository Security tab after the first workflow run.

## Vercel

1. In the Vercel project settings, disconnect the GitLab repository integration.
2. Connect the new GitHub repository.
3. Set the production branch to `main`.
4. Confirm the framework preset is Nuxt.
5. Confirm the build command is `npm run build`.
6. Confirm Vercel still has these environment variables:

   ```text
   MONGODB_URI
   MONGODB_DB_NAME
   NUXT_PUBLIC_MAP_STYLE_URL
   CLOUDINARY_CLOUD_NAME
   CLOUDINARY_API_KEY
   CLOUDINARY_API_SECRET
   OPENAI_API_KEY
   OPENAI_DESCRIPTION_MODEL
   BETTER_AUTH_URL
   BETTER_AUTH_TRUSTED_ORIGINS
   BETTER_AUTH_SECRET
   BETTER_AUTH_API_KEY
   AUTH_EMAIL_FROM
   RESEND_API_KEY
   ```

7. Update `BETTER_AUTH_URL` to the production site URL if it changes.
8. Update `BETTER_AUTH_TRUSTED_ORIGINS` to include the production domain and any Vercel preview domains you use.
9. Trigger a fresh production deployment from the GitHub-connected project.

## MongoDB Atlas

No repository URL is embedded in the app's MongoDB configuration. Check MongoDB Atlas only if any of these apply:

1. Vercel redeploys from a different project and uses different outbound IP behavior.
2. Atlas network access is restricted to specific IP addresses.
3. Database user credentials are rotated during the migration.

If the app keeps using the same `MONGODB_URI`, `MONGODB_DB_NAME`, database user, and Atlas network access policy, no MongoDB data migration is needed.

## Other Services

Review these service credentials because the app depends on them at runtime:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
OPENAI_API_KEY
RESEND_API_KEY
```

They do not need to know about GitHub unless you configured GitLab-specific access controls outside this repository.

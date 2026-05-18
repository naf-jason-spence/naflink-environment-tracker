# Deploying to GitHub Pages

1. Commit and push the new `docs` folder and `.nojekyll` file:
   ```sh
git add docs/.nojekyll docs/*
git commit -m "Build for GitHub Pages deployment"
git push
```

2. On GitHub, go to your repository settings > Pages.
   - Set the source branch to `main` (or your default branch) and the folder to `/docs`.
   - Save.

3. Your site will be available at:
   `https://<your-username>.github.io/naflink-environment-tracker/`

If you need a custom domain, you can configure it in the same Pages settings.

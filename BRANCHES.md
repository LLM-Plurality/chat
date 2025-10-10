# Git Branches Guide

## Current Branches

### `feature/personas` Branch
**Created:** October 3, 2025  
**Purpose:** Complete persona system implementation replacing the old customPrompts system  
**Status:** Ready for testing and review  

**What's included (24 commits):**
- Persona type definition and default personas (healthcare debate perspectives)
- Database migration to replace customPrompts with personas
- PersonaSelector component for quick switching
- Personas gallery page with search, edit, and activation
- Full CRUD persona editor in settings
- Tab-based settings navigation (Models, Personas, Settings)
- Integration with conversation creation and message generation
- UI redesign for model/persona display in chat window

---

## How to Push to the Feature Branch

From your current state (after rebase), push to the feature branch:

```bash
cd /c/Dev/Plurality/chat
git push origin main:feature/personas
```

This creates a new branch called `feature/personas` on the remote with all your commits.

---

## How to Test the Feature Branch

**On another machine or after switching:**

```bash
# Switch to the feature branch
git checkout feature/personas

# Pull latest changes
git pull origin feature/personas

# Install dependencies (if needed)
npm install

# Run the application
npm run dev
```

---

## How to Merge Back to Main

Once the feature is tested and approved, you have two options:

### Option 1: Merge via Pull Request (Recommended)
1. Create a Pull Request on GitHub/GitLab from `feature/personas` to `main`
2. Request code review from team members
3. Once approved, merge using the platform's merge button
4. Delete the feature branch after merge

### Option 2: Manual Merge (Command Line)
```bash
# Make sure you're on main and it's up to date
git checkout main
git pull origin main

# Merge the feature branch
git merge feature/personas

# If there are conflicts, resolve them, then:
git add .
git commit -m "Resolve merge conflicts"

# Push to main
git push origin main

# Delete the feature branch (optional)
git branch -d feature/personas
git push origin --delete feature/personas
```

---

## Common Branch Commands

### See all branches
```bash
git branch -a
```

### Switch branches
```bash
git checkout branch-name
```

### Create a new branch
```bash
git checkout -b new-branch-name
```

### Update your branch with latest main
```bash
# While on your feature branch
git fetch origin
git rebase origin/main
```

### See what's different between branches
```bash
git diff main..feature/personas
```

### Undo/Reset (if needed)
```bash
# Undo local changes
git reset --hard origin/feature/personas

# Go back to a specific commit
git reset --hard COMMIT_HASH
```

---

## Branching Best Practices

1. **One feature per branch** - Keep branches focused on a single feature or fix
2. **Descriptive names** - Use names like `feature/personas`, `fix/login-bug`, `refactor/api-cleanup`
3. **Regular updates** - Rebase with main regularly to avoid large conflicts later
4. **Small commits** - Make frequent, logical commits with clear messages
5. **Clean up** - Delete merged branches to keep the repository tidy
6. **Never force push to main** - Use `--force` only on feature branches and only when necessary

---

## Troubleshooting

### "Your branch has diverged"
This happens when remote and local have different commits. Solutions:
```bash
# If you want to keep your local changes
git rebase origin/branch-name

# If you want to match remote exactly
git reset --hard origin/branch-name
```

### Merge Conflicts
When Git can't automatically merge:
1. Open conflicted files (marked with `<<<<<<<`, `=======`, `>>>>>>>`)
2. Edit to keep the correct code
3. Remove conflict markers
4. Stage the resolved files: `git add filename`
5. Continue: `git rebase --continue` or `git commit`

### Need to switch branches but have uncommitted changes
```bash
# Save changes for later
git stash

# Switch branches
git checkout other-branch

# Come back and restore changes
git checkout original-branch
git stash pop
```

---

## Notes for This Project

- **Main branch** should always be deployable
- Test thoroughly on feature branches before merging
- The persona feature includes a database migration - ensure it runs successfully before merging
- Breaking changes: This feature removes `customPrompts` - ensure no other code depends on it


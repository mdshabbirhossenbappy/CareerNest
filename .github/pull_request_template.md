## Summary

Describe the changes and feature scope implemented in this PR.

## Security Checklist

- [ ] No secrets, `.env` files, or keys committed
- [ ] All inputs validated with `zod` (`.strict()`)
- [ ] Role-based access control and ownership (IDOR) checks verified
- [ ] Frontend uses `textContent` instead of `innerHTML`
- [ ] No explanatory comments in code files

## Verification

- [ ] `npm run format:check` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes

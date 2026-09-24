# Project instructions

This repository is the yedhod project. Read CLAUDE.md for architecture and commands.

## Local project access

The user supplied Coolify access for this project only. The base URL is
`https://coolify.xn--l3ca4bxbygoa7a.com`.
On this Windows checkout the token is stored with current-user Windows DPAPI at
`.codex/private/coolify-token.dpapi` (excluded from Git). Use the local helper
`.codex/private/coolify.ps1` to load it in memory. Never print, commit, or copy the
token to another project or global memory. If that file is absent on another
machine, request project credentials instead of searching other projects.

Credential availability does not authorize unrelated deployments or account changes.

## Protected Telegram source

The user explicitly requires keeping Telegram group `-1003892087188` in the sync
configuration. Never remove it during source cleanup, even when access or media
downloads fail; diagnose and recover that source instead.

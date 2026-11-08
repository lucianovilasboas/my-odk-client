"""Configuração do adaptador, toda vinda do ambiente.

Nenhum token de App User entra aqui: cada agente configura o seu pelo QR
(ADR 0003). O servidor guarda apenas a chave que cifra o cookie de sessão.
"""

from __future__ import annotations

import base64
import binascii
import os
from dataclasses import dataclass


class ConfigError(RuntimeError):
    """Configuração ausente ou inválida. Falha na inicialização, nunca em runtime."""


@dataclass(frozen=True)
class Settings:
    session_secret: bytes
    allowed_hosts: tuple[str, ...]
    allowed_projects: tuple[str, ...]
    cookie_secure: bool = True
    session_ttl_seconds: int = 12 * 60 * 60
    central_timeout_seconds: float = 30.0
    max_resource_bytes: int = 20 * 1024 * 1024
    max_submission_bytes: int = 50 * 1024 * 1024


def _decode_secret(raw: str) -> bytes:
    try:
        chave = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ConfigError('SESSION_SECRET precisa ser base64 válido') from exc
    if len(chave) != 32:
        raise ConfigError(
            f'SESSION_SECRET precisa ter 32 bytes após decodificar base64 (tem {len(chave)})'
        )
    return chave


def load_settings(env: dict[str, str] | None = None) -> Settings:
    env = dict(os.environ if env is None else env)

    secret = env.get('SESSION_SECRET', '').strip()
    if not secret:
        raise ConfigError('SESSION_SECRET não configurado; gere com: openssl rand -base64 32')

    hosts = tuple(h.strip().lower() for h in env.get('ALLOWED_CENTRAL_HOSTS', '').split(',') if h.strip())
    if not hosts:
        raise ConfigError('ALLOWED_CENTRAL_HOSTS vazio: o adaptador não pode aceitar qualquer host')

    # Opcional: o projeto vem do QR. Vazio significa aceitar qualquer projeto do
    # host permitido — quem autoriza o acesso é o App User no Central.
    projects = tuple(p.strip() for p in env.get('ALLOWED_PROJECT_IDS', '').split(',') if p.strip())

    return Settings(
        session_secret=_decode_secret(secret),
        allowed_hosts=hosts,
        allowed_projects=projects,
        cookie_secure=env.get('COOKIE_SECURE', 'true').lower() != 'false',
    )

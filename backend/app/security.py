"""Cifragem do cookie de sessão e derivação do workspace.

O token do App User nunca é persistido em claro: ele vive apenas dentro do cookie
cifrado com AES-GCM. O cliente recebe somente o `workspaceId`, derivado por HMAC
e não reversível (ADR 0003).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import secrets as _secrets

_V = 1


class SessionInvalid(RuntimeError):
    """Cookie ausente, adulterado, expirado ou de versão desconhecida."""


def derive_workspace_id(secret: bytes, token: str) -> str:
    """Identificador opaco e estável do agente. Não permite recuperar o token."""
    return hmac.new(secret, token.encode('utf-8'), hashlib.sha256).hexdigest()[:32]


def seal(secret: bytes, payload: dict[str, Any]) -> str:
    nonce = _secrets.token_bytes(12)
    corpo = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    return base64.urlsafe_b64encode(nonce + AESGCM(secret).encrypt(nonce, corpo, None)).decode('ascii')


def unseal(secret: bytes, blob: str) -> dict[str, Any]:
    try:
        raw = base64.urlsafe_b64decode(blob.encode('ascii'))
    except Exception as exc:  # noqa: BLE001 - qualquer defeito é sessão inválida
        raise SessionInvalid('cookie ilegível') from exc

    if len(raw) <= 12:
        raise SessionInvalid('cookie truncado')

    nonce, cifrado = raw[:12], raw[12:]
    try:
        corpo = AESGCM(secret).decrypt(nonce, cifrado, None)
    except InvalidTag as exc:
        raise SessionInvalid('cookie adulterado') from exc

    try:
        dados = json.loads(corpo)
    except json.JSONDecodeError as exc:
        raise SessionInvalid('cookie não é JSON') from exc

    if dados.get('v') != _V:
        raise SessionInvalid('versão de cookie desconhecida')
    if int(dados.get('exp', 0)) <= int(time.time()):
        raise SessionInvalid('sessão expirada')

    for campo in ('token', 'host', 'project_id'):
        if not dados.get(campo):
            raise SessionInvalid(f'cookie sem {campo}')

    return dados


def nova_sessao(token: str, host: str, project_id: str, ttl_seconds: int) -> dict[str, Any]:
    agora = int(time.time())
    return {
        'v': _V,
        'token': token,
        'host': host,
        'project_id': project_id,
        'iat': agora,
        'exp': agora + ttl_seconds,
    }


def deve_renovar(dados: dict[str, Any], ttl_seconds: int, agora: int | None = None) -> bool:
    """Renova quando resta metade do prazo, para não reescrever o cookie a cada request."""
    agora = int(time.time()) if agora is None else agora
    return int(dados.get('exp', 0)) - agora <= ttl_seconds // 2

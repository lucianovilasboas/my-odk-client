"""Carregamento da configuração: allowlist e projeto passam a ser opcionais."""

from __future__ import annotations

import base64

import pytest

from app.settings import ConfigError, load_settings

SECRET = base64.b64encode(b'0' * 32).decode()


def test_sessao_e_suficiente_para_subir():
    configuracao = load_settings({'SESSION_SECRET': SECRET})

    assert configuracao.allowed_hosts == ()
    assert configuracao.allowed_projects == ()


def test_allowlists_preenchidas_sao_normalizadas():
    configuracao = load_settings(
        {
            'SESSION_SECRET': SECRET,
            'ALLOWED_CENTRAL_HOSTS': ' ODK.Exemplo.Test , outro.exemplo.test ',
            'ALLOWED_PROJECT_IDS': ' 14 , 15 ',
        }
    )

    assert configuracao.allowed_hosts == ('odk.exemplo.test', 'outro.exemplo.test')
    assert configuracao.allowed_projects == ('14', '15')


def test_listas_vazias_viram_tuplas_vazias():
    configuracao = load_settings(
        {'SESSION_SECRET': SECRET, 'ALLOWED_CENTRAL_HOSTS': '', 'ALLOWED_PROJECT_IDS': ' , '}
    )

    assert configuracao.allowed_hosts == ()
    assert configuracao.allowed_projects == ()


def test_segredo_ausente_falha_na_inicializacao():
    with pytest.raises(ConfigError, match='SESSION_SECRET'):
        load_settings({})


def test_segredo_com_tamanho_errado_falha():
    curto = base64.b64encode(b'curto').decode()

    with pytest.raises(ConfigError, match='32 bytes'):
        load_settings({'SESSION_SECRET': curto})

#!/usr/bin/env python3
"""Gera os ícones da PWA a partir de `icon-source.png`.

A fonte é o símbolo com fundo transparente. Os ícones usam o teal da marca em
full bleed e o símbolo centralizado dentro da área segura: o Android recorta
`maskable` em círculo ou "squircle" e qualquer coisa nas bordas desaparece.
"""

from pathlib import Path

from PIL import Image

AQUI = Path(__file__).parent
FONTE = AQUI / "icon-source.png"
FUNDO = (10, 62, 61)  # #0A3E3D

# `maskable` exige a arte dentro dos 80% centrais; `any` pode ocupar mais.
TAMANHOS = [
    ("icon-192.png", 192, 0.88),
    ("icon-512.png", 512, 0.88),
    ("icon-maskable-512.png", 512, 0.70),
]


def gerar(nome: str, lado: int, escala: float) -> None:
    arte = Image.open(FONTE).convert("RGBA")
    arte.thumbnail((int(lado * escala), int(lado * escala)), Image.LANCZOS)

    tela = Image.new("RGB", (lado, lado), FUNDO)
    tela.paste(arte, ((lado - arte.width) // 2, (lado - arte.height) // 2), arte)
    tela.save(AQUI / nome, "PNG", optimize=True)
    print(f"{nome}: {lado}x{lado} (arte {int(escala * 100)}%)")


for nome, lado, escala in TAMANHOS:
    gerar(nome, lado, escala)

#!/usr/bin/env python3
"""Gera os ícones da PWA a partir de `icon-source.png`.

A fonte tem cantos brancos fora do quadrado arredondado. Aqui o fundo teal é
recriado e a arte é recortada por uma máscara arredondada, de modo que os cantos
brancos desapareçam e o resultado fique chapado (full bleed) — que é o que o
Android espera, inclusive no recorte `maskable`.
"""

from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).parent
FONTE = AQUI / "icon-source.png"
FUNDO = (10, 62, 61)  # #0A3E3D, amostrado da fonte

# `maskable` exige a arte dentro dos 80% centrais; `any` pode ocupar mais.
TAMANHOS = [
    ("icon-192.png", 192, 0.90),
    ("icon-512.png", 512, 0.90),
    ("icon-maskable-512.png", 512, 0.78),
]


def recorte_arredondado(lado: int, raio_relativo: float) -> Image.Image:
    mascara = Image.new("L", (lado, lado), 0)
    desenho = ImageDraw.Draw(mascara)
    desenho.rounded_rectangle(
        (0, 0, lado - 1, lado - 1), radius=int(lado * raio_relativo), fill=255
    )
    return mascara


def gerar(nome: str, lado: int, escala: float) -> None:
    fonte = Image.open(FONTE).convert("RGB")

    arte_lado = int(lado * escala)
    arte = fonte.resize((arte_lado, arte_lado), Image.LANCZOS)
    # Raio maior que o da fonte: onde a máscara corta, aparece o teal do fundo.
    arte.putalpha(recorte_arredondado(arte_lado, 0.30))

    tela = Image.new("RGB", (lado, lado), FUNDO)
    deslocamento = (lado - arte_lado) // 2
    tela.paste(arte, (deslocamento, deslocamento), arte)

    destino = AQUI / nome
    tela.save(destino, "PNG", optimize=True)
    print(f"{destino.name}: {lado}x{lado} (arte {int(escala * 100)}%)")


for nome, lado, escala in TAMANHOS:
    gerar(nome, lado, escala)
